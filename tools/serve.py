#!/usr/bin/env python3
"""
声浪星球 · 带 Range 的静态服务器（本地核对用）

为什么需要它：python -m http.server 不支持 Range 请求，
浏览器拿不到 seekable 区间 ⇒ <audio>.currentTime 无法跳转，
截图核对就没法"定位到副歌再看画面"。

用法:
    python3 tools/serve.py 8781            # 从仓库根目录起服
    python3 tools/serve.py 8781 <root>
"""
import os
import re
import sys
import mimetypes
from http.server import HTTPServer, SimpleHTTPRequestHandler

RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")


class RangeHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):          # 静音
        pass

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        if not os.path.isfile(path):
            self.send_error(404, "Not Found")
            return None

        rng = self.headers.get("Range")
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "Not Found")
            return None

        size = os.fstat(f.fileno()).st_size
        ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"

        start, end = 0, size - 1
        partial = False
        if rng:
            m = RANGE_RE.match(rng.strip())
            if m:
                g1, g2 = m.group(1), m.group(2)
                if g1 == "" and g2:                    # bytes=-N （末尾 N 字节）
                    start = max(0, size - int(g2))
                elif g1 != "":
                    start = int(g1)
                    if g2:
                        end = min(int(g2), size - 1)
                if start > end or start >= size:
                    f.close()
                    self.send_response(416)
                    self.send_header("Content-Range", "bytes */%d" % size)
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return None
                partial = True

        length = end - start + 1
        self.send_response(206 if partial else 200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(length))
        if partial:
            self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.end_headers()
        f.seek(start)
        self._remaining = length
        self._file = f
        return f

    def copyfile(self, source, outputfile):
        remaining = getattr(self, "_remaining", None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        while remaining > 0:
            chunk = source.read(min(262144, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8781
    root = sys.argv[2] if len(sys.argv) > 2 else os.getcwd()
    os.chdir(root)
    mimetypes.add_type("audio/mpeg", ".mp3")
    mimetypes.add_type("audio/wav", ".wav")
    srv = HTTPServer(("127.0.0.1", port), RangeHandler)
    print("serving %s at http://127.0.0.1:%d/ (Range enabled)" % (root, port), flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
