"""Extract the CMS content of the original site from saved HTML snapshots into JSON.

Usage: python -I scripts/extract-cms.py scripts/source-snapshot data
Requires: beautifulsoup4
"""
import json
import os
import re
import sys

from bs4 import BeautifulSoup

SRC, OUT = sys.argv[1], sys.argv[2]
IMAGES = set()


def load(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return BeautifulSoup(f.read(), 'html.parser')


def txt(el):
    return ' '.join(el.get_text(' ', strip=True).split()) if el else ''


def img(el):
    if not el:
        return None
    src = el.get('src') or ''
    if not src:
        return None
    IMAGES.add(src)
    return src


def visible(el):
    """Webflow hides conditional elements with w-condition-invisible."""
    while el is not None and getattr(el, 'get', None):
        if 'w-condition-invisible' in (el.get('class') or []):
            return False
        el = el.parent
    return True


def write(name, data):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print('wrote', name, len(data) if isinstance(data, list) else '')


# ---------------------------------------------------------------- races
CAL_FIELDS = ['circuit-id', 'circuit-name', 'circuit-lap-amount', 'circuit-lap-length', 'circuit-distance',
              'first-competed-date', 'date-actual', 'date-from-to-num', 'date-from-to-month',
              'prac1-date', 'prac1-time', 'prac2-date', 'prac2-time', 'prac3-date', 'prac3-time',
              'qual-date', 'qual-time', 'race-date', 'race-time',
              'prac1-time-result', 'prac1-time-pos', 'prac2-time-result', 'prac2-time-pos',
              'prac3-time-result', 'prac3-time-pos', 'qual-time-result', 'qual-time-pos',
              'race-time-result', 'race-time-pos']


def camel(k):
    p = k.split('-')
    return p[0] + ''.join(x.title() for x in p[1:])


def trophy(item):
    """Which trophy variant is visible: gold (default), grey (silver) or bronze."""
    for w in item.select('.f1-highlight-trophy-w'):
        if visible(w):
            cls = w.get('class')
            kind = 'grey' if 'is-grey' in cls else 'bronze' if 'is-bronze' in cls else 'gold'
            return {'kind': kind, 'img': img(w.select_one('img'))}
    return None


cal = load('calendar.html')
races = []
for it in cal.select('[data-cal-wrap] [data-cal-item]'):
    r = {}
    for k in CAL_FIELDS:
        e = it.select_one(f'[data-cal-list="{k}"]')
        if e is None:
            r[camel(k)] = ''
        elif k == 'circuit-about':
            r[camel(k)] = e.decode_contents().strip()
        else:
            r[camel(k)] = '' if 'w-dyn-bind-empty' in (e.get('class') or []) else txt(e)
    about = it.select_one('[data-cal-list="circuit-about"]')
    r['circuitAbout'] = about.decode_contents().strip() if about else ''
    dash = it.select('.on-t-stat-dash-item')
    r['name'] = txt(dash[1].select('div')[1]) if len(dash) > 1 else ''
    r['round'] = int(txt(it.select_one('[data-text-format="round"]')) or 0)
    grid = it.select('.f1-highlight-grid-item')
    r['location'] = txt(grid[1].select_one('.text-on-t-stat-label-major')) if len(grid) > 1 else ''
    r['flag'] = img(it.select_one('img[data-cal-list="circuit-flag"]'))
    when = grid[2].select('.text-on-t-stat-label-major') if len(grid) > 2 else []
    r['listDate'] = txt(when[0]) if when else ''
    pos = it.select_one('[data-text-format="position"]')
    r['finish'] = '' if pos is None or 'w-dyn-bind-empty' in (pos.get('class') or []) else txt(pos)
    finish_extra = grid[3].select('.text-on-t-stat-label-major:not([data-text-format])') if len(grid) > 3 else []
    r['finishNote'] = txt(finish_extra[0]) if finish_extra else ''
    gap = grid[4].select('.text-on-t-stat-label-reg') if len(grid) > 4 else []
    r['fastestLap'] = txt(gap[0]) if gap else ''
    r['trophy'] = trophy(it)
    hover = it.select_one('[data-stat-hover-img]')
    r['hoverImg'] = None if hover is None or 'w-dyn-bind-empty' in (hover.get('class') or []) else img(hover)
    sprint = it.select_one('[data-cal-sprint="true"]')
    r['sprint'] = bool(sprint and visible(sprint))
    # The original renders two CMS lists: past ("is-previous") and upcoming (laps/distance columns).
    r['sourceList'] = 'previous' if 'is-previous' in (it.get('class') or []) else 'upcoming'
    if r['sourceList'] == 'upcoming':
        r['fastestLap'] = r['finishNote'] = ''
    races.append(r)

# Status text such as DNS/NS appears in the finish column when the position is empty.
for it, r in zip(cal.select('[data-cal-wrap] [data-cal-item]'), races):
    lay = it.select_one('.f1-highlight-grid-item-text-layout')
    if lay and not r['finish'] and r['sourceList'] == 'previous':
        r['finishNote'] = txt(lay)
write('races.json', races)

# ---------------------------------------------------------------- season history
history = []
for item in cal.select('[data-calendar-history="item"]'):
    trig = item.select_one('[data-calendar-history="trigger"]')
    labels = trig.select('.text-on-t-stat-label-major')
    season = {
        'year': txt(trig.select_one('h3')),
        'finish': txt(trig.select_one('[data-text-format="position"]')),
        'podiums': txt(labels[-1]) if labels else '',
        'races': [],
    }
    for row in item.select('[data-stat-item-dd]'):
        grid = row.select('.f1-highlight-grid-item')
        when = grid[2].select('.text-on-t-stat-label-major') if len(grid) > 2 else []
        pos = row.select_one('[data-text-format="position"]')
        regs = row.select('.text-on-t-stat-label-reg')
        season['races'].append({
            'round': int(txt(row.select_one('[data-text-format="round"]')) or 0),
            'location': txt(row.select_one('h4')),
            'flag': img(row.select_one('h4 ~ div img, .flag-w img')),
            'date': txt(when[0]) if when else '',
            'year': txt(when[1]) if len(when) > 1 else '',
            'finish': txt(pos) if pos and 'w-dyn-bind-empty' not in (pos.get('class') or []) else '',
            'fastestLap': next((txt(x) for x in regs if re.match(r'^\d+:\d', txt(x))), ''),
            'trophy': trophy(row),
            'hoverImg': img(row.select_one('[data-stat-hover-img]')),
        })
    history.append(season)
write('history.json', history)

# ---------------------------------------------------------------- on-track page
ot = load('on-track.html')
highlights = []
for it in ot.select('[data-mouse-area="highlights"] .f1-highlight-grid.is-highlights'):
    grid = it.select('.f1-highlight-grid-item')
    when = grid[2].select('.text-on-t-stat-label-major') if len(grid) > 2 else []
    regs = [txt(x) for x in it.select('.text-on-t-stat-label-reg')]
    highlights.append({
        'series': txt(grid[0]) if grid else '',
        'name': txt(grid[1].select_one('.text-on-t-stat-label-major')) if len(grid) > 1 else '',
        'flag': img(grid[1].select_one('img')) if len(grid) > 1 else None,
        'date': txt(when[0]) if when else '',
        'year': txt(when[1]) if len(when) > 1 else '',
        'finish': txt(it.select_one('[data-text-format="position"]')),
        'time': next((x for x in regs if re.match(r'^[\d:.+]+', x) and ':' in x), ''),
        'gap': next((x for x in regs if x.startswith('+')), '-'),
        'trophy': trophy(it),
        'hoverImg': img(it.select_one('[data-stat-hover-img]')),
    })
write('highlights.json', highlights)

seasons = []
for it in ot.select('[data-stat-item].f1-car-stat-past-v2-grid-item'):
    vals = [txt(x) for x in it.select('h3, .text-on-t-stat-label-reg, .text-descriptor')]
    vals = [v for v in vals if v]
    seasons.append(vals)
write('career-seasons-raw.json', seasons)

pref1 = []
for c in ot.select('.text-descriptor'):
    pass
for row in ot.select('[class*="pre-f1"], [class*="junior"]'):
    t = txt(row)
    if t:
        pref1.append(t)
write('pre-f1-raw.json', pref1)

podium_media = [img(x) for x in ot.select('[data-podium-media] img')]
write('podium-media.json', podium_media)

# ---------------------------------------------------------------- helmets (home)
home = load('home.html')
helmets = []
for it in home.select('.helmet-grid-item-w.w-dyn-item'):
    label = it.select_one('h3')
    parts = [txt(x) for x in label.find_all(string=True) if x.strip()] if label else []
    helmets.append({
        'name': parts[0] if parts else '',
        'year': parts[-1] if len(parts) > 1 else (re.findall(r'helm-(\d{4})', it.select_one('img').get('src', '')) or [''])[0],
        'img': img(it.select_one('.helmet-grid-item-img-helmet')),
        'revealImg': img(it.select_one('.helmet-grid-item-reveal-img')),
    })
write('helmets.json', helmets)


# ---------------------------------------------------------------- horizontal galleries
def horizontal(soup):
    sec = soup.select_one('[data-horizontal-section]')
    cards = []
    for w in sec.select('.horizontal-item-w'):
        if w.find_parent(class_='horizontal-item-w'):
            continue
        cls = [c for c in w.get('class') if c != 'horizontal-item-w']
        pic = w.select_one('img.is-horizontal-scroll')
        heading = w.select_one('h2, h3')
        if 'is-text-callout' in cls:
            cards.append({'kind': 'quote', 'variant': cls, 'text': txt(w.select_one('.horizontal-item-text')),
                          'img': img(w.select_one('img'))})
        elif heading and not pic:
            sub = w.select_one('.text-eyebrow, .text-descriptor')
            cards.append({'kind': 'title', 'variant': cls, 'title': txt(heading), 'subtitle': txt(sub)})
        else:
            pill = w.select_one('.horizontal-item-pill-w')
            caption = w.select_one('.text-eyebrow')
            cards.append({'kind': 'photo', 'variant': cls,
                          'caption': txt(caption),
                          'img': img(pic), 'alt': pic.get('alt', '') if pic else '',
                          'heading': txt(heading) if heading else '',
                          'pill': {'text': txt(pill), 'icon': img(pill.select_one('img'))} if pill else None})
    return cards


write('gallery-home.json', horizontal(home))
write('gallery-on-track.json', horizontal(ot))
write('gallery-off-track.json', horizontal(load('off-track.html')))

# ---------------------------------------------------------------- shared assets
nav_imgs = []
for w in home.select('[data-nav-img]'):
    i = w.select_one('img.menu-img-top')
    nav_imgs.append({'index': int(w['data-nav-img']), 'img': img(i), 'alt': i.get('alt', '') if i else ''})
write('nav-images.json', sorted(nav_imgs, key=lambda x: x['index']))

partners = {
    'marqueeLogos': [img(x) for x in home.select('.marquee-advanced__collection img')],
    'cssMarqueeLogos': [img(x) for x in home.select('[data-css-marquee-list] img')],
    'footerLogos': [img(x) for x in home.select('.marquee-adv-collection img')],
    'placeholder': img(home.select_one('.is-collab-placeholder')),
}
write('partners.json', partners)

socials = {
    'home': [{'vimeo': x.get('data-stream-url'), 'poster': img(x.select_one('img'))} for x in home.select('[data-video-stream]')],
    'offTrack': [{'vimeo': x.get('data-stream-url'), 'poster': img(x.select_one('img'))}
                 for x in load('off-track.html').select('[data-video-stream]')],
}
write('socials.json', socials)

off = load('off-track.html')
offtrack = {
    'heroMedia': [img(x) for x in off.select('.off-t-hero-scroll-meda-img')],
    'campaigns': [{'title': txt(x.select_one('h3, h2')), 'img': img(x.select_one('img'))} for x in off.select('.camp-item')],
}
write('off-track.json', offtrack)

exe = [img(x) for x in home.select('.is-exe-scroll, .is-exe-sticker')]
write('store-promo.json', exe)

# ---------------------------------------------------------------- legal pages
legal = {}
for key, fname in [('terms-conditions', 'legal_terms-conditions.html'), ('privacy-policy', 'legal_privacy-policy.html')]:
    s = load(fname)
    rt = s.select('.w-richtext')
    title = s.select_one('h1')
    legal[key] = {'title': txt(title), 'html': '\n'.join(r.decode_contents() for r in rt)}
write('legal.json', legal)

# Every remaining <img> in every page, for the asset mirror.
for f in os.listdir(SRC):
    if f.endswith('.html'):
        for i in load(f).select('img[src]'):
            if i['src'].startswith('http'):
                IMAGES.add(i['src'])
        for i in load(f).select('[srcset]'):
            pass
images = sorted(x for x in IMAGES if x and x.startswith('http'))
write('_image-urls.json', images)
