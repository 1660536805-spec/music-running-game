"""Authored 30-second vocal charts. Times are relative to the bundled excerpts.

Chinese lyric starts follow the original project's lyrics.srt after subtracting 33.733 s.
English line starts are aligned to the 8–39 s excerpt of Josh Woodward's Knock.
"""
from __future__ import annotations

import json
from pathlib import Path

ASSETS = Path(__file__).resolve().parents[1] / 'assets'


def build(song, title, bpm, duration, lines, actions, holds, sections):
    spb = 60 / bpm
    speed = 11
    chart = {
        'schema': 1, 'song': song, 'title': title, 'bpm': bpm,
        'spb': round(spb, 6), 'bar': round(4 * spb, 6),
        'beats': round(duration / spb), 'bars': max(1, round(duration / (4 * spb))),
        'duration': duration,
        'track': {'width': 3.5, 'base': speed, 'sprint': speed, 'sprintAt': 2,
                  'layerHi': .9, 'switchMs': 90, 'z0': 3.8},
        'sections': [
            {'index': i, 'kind': kind, 'label': label, 't0': a, 't1': b,
             'bars': max(1, round((b-a)/(4*spb))), 'energy': energy,
             'density': .3, 'speed': speed, 'camera': 'chase', 'special': None}
            for i, (a,b,kind,label,energy) in enumerate(sections)
        ],
        'lyrics': [{'t': t, 'end': end, 'text': text, 'kind': kind}
                   for t, end, text, kind in lines],
        'onsets': [], 'anticipations': [], 'lensCues': [],
        'sustains': [{'t0': start, 't1': end, 'midi': note, 'lyric': lyric}
                     for start, end, note, lyric in holds],
        'phrase': {'bars': [0, round(duration / 2, 3), duration]},
        'vocalCues': [], 'obstacles': [],
    }
    for i, (t, op, lyric) in enumerate(actions):
        if op == 'up':
            kind, layer, answer, instruction = 'gate', 'lo', 'hi', '↑ 升到高层'
        elif op == 'down':
            kind, layer, answer, instruction = 'gate', 'hi', 'lo', '↓ 降到低层'
        elif op == 'rest':
            kind, layer, answer, instruction = 'twin', 'both', 'hold', '停顿 · 不切层'
        else:
            raise ValueError(op)
        chart['obstacles'].append({
            'id': f'v{i}', 'beat': round(t / spb, 2), 't': t,
            'z': round(3.8 - speed*t, 3), 'type': kind,
            'layer': layer, 'answer': answer, 'lyric': lyric,
        })
        chart['vocalCues'].append({'t': t, 'op': op, 'lyric': lyric, 'text': instruction})
    for start, end, _, lyric in holds:
        chart['vocalCues'].append({'t': start, 'end': end, 'op': 'hold',
                                   'lyric': lyric, 'text': '长音 · 按住空格，尾音松开'})
    chart['vocalCues'].sort(key=lambda x: x['t'])
    return chart


chinese = build(
    'openSourcePeople', '开源人之歌 · 歌词共鸣', 92, 30.5,
    [
        (0, 3.233, '我自娱自乐，荣辱不惊', 'verse'),
        (3.233, 7.333, '事了拂衣去，深藏功名', 'verse'),
        (7.333, 10.100, '以梦为码，仗键横行', 'verse'),
        (10.100, 13.967, '痛快Hacking，激情Coding', 'verse'),
        (13.967, 17.633, '有朋自远方来，不亦乐乎', 'preChorus'),
        (17.633, 21.000, '志同道合，吾道不孤', 'preChorus'),
        (21.000, 24.433, '面对屏幕，遥想当初', 'chorus'),
        (24.433, 30.433, '少年志气，咬牙不服输', 'outro'),
    ],
    [(2.4,'up',0), (5.0,'down',1), (8.6,'up',2), (11.8,'down',3),
     (15.4,'up',4), (19.2,'rest',5), (22.5,'down',6), (25.8,'up',7),
     (28.0,'rest',7)],
    [(12.7,13.82,67,3), (23.2,24.3,64,6), (28.55,30.25,69,7)],
    [(0,13.967,'verse','叙事 · 逐句应答',.55),
     (13.967,21,'preChorus','相遇 · 呼吸留白',.68),
     (21,24.433,'chorus','回望 · 旋律下行',.8),
     (24.433,30.5,'outro','志气 · 长音收束',.9)],
)
english = build(
    'knockVocal', 'Knock · Lyric Ride', 119, 31,
    [
        (0,3.7,'On a streetcar in Tacoma, on a Sunday in July','verse'),
        (3.7,7.7,"You're kicking off your sandals, as you stare up at the sky",'verse'),
        (7.7,11.5,'I look at you and fumble, for the perfect thing to say','verse'),
        (11.5,14.2,'But my nerves get in the way','verse'),
        (14.2,18.6,"I've cherished you for ages, but my words were locked in cages",'preChorus'),
        (18.6,22.4,'So afraid that you just saw me as a friend','preChorus'),
        (22.4,26.8,'Now I want to set them free, my fingers clenching to the key','chorus'),
        (26.8,31,'But I am frozen once again','outro'),
    ],
    [(1.8,'up',0), (4.8,'down',1), (6.5,'up',1), (9.3,'down',2),
     (12.7,'rest',3), (15.5,'up',4), (17.5,'down',4), (20.0,'up',5),
     (23.6,'down',6), (25.7,'up',6), (28.6,'rest',7)],
    [(12.9,14.05,64,3), (20.9,22.2,67,5), (29.1,30.7,62,7)],
    [(0,14.2,'verse','街车 · 轻快换层',.62),
     (14.2,22.4,'preChorus','欲言又止 · 句尾呼吸',.74),
     (22.4,26.8,'chorus','说出口 · 连续换层',.83),
     (26.8,31,'outro','凝住 · 停顿收束',.58)],
)
english['visualLyrics'] = [
    {'t': t, 'text': text, 'kind': kind}
    for t, text, kind in [
        (0, 'On a streetcar in Tacoma', 'verse'),
        (1.9, 'on a Sunday in July', 'verse'),
        (3.7, "You're kicking off your", 'verse'),
        (5.1, 'sandals, as you stare up', 'verse'),
        (6.4, 'at the sky', 'verse'),
        (7.7, 'I look at you and fumble', 'verse'),
        (9.6, 'for the perfect thing', 'verse'),
        (10.8, 'to say', 'verse'),
        (11.5, 'But my nerves', 'verse'),
        (12.6, 'get in the way', 'verse'),
        (14.2, "I've cherished you", 'preChorus'),
        (16.0, 'for ages', 'preChorus'),
        (17.0, 'but my words were locked', 'preChorus'),
        (18.0, 'in cages', 'preChorus'),
        (18.6, 'So afraid that you just', 'preChorus'),
        (20.8, 'saw me as a friend', 'preChorus'),
        (22.4, 'Now I want to', 'chorus'),
        (23.7, 'set them free', 'chorus'),
        (24.8, 'my fingers clenching', 'chorus'),
        (26.0, 'to the key', 'chorus'),
        (26.8, 'But I am frozen', 'outro'),
        (29.0, 'once again', 'outro'),
    ]
]

for name, chart in [('open-source-vocal-chart.json', chinese), ('knock-vocal-chart.json', english)]:
    (ASSETS / name).write_text(json.dumps(chart, ensure_ascii=False, indent=2) + '\n')
    print(name, len(chart['lyrics']), 'lines', len(chart['obstacles']), 'obstacles')
