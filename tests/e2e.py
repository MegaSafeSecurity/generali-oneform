import json, re, urllib.request, sys
from playwright.sync_api import sync_playwright
BASE = "http://localhost:8099/generali-oneform/"; MOCK = "http://localhost:54321"; SH = "/home/claude/work/shots/"
res = []
def ok(name, cond, extra=''): res.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name, extra)
def mock(path): return json.loads(urllib.request.urlopen(urllib.request.Request(MOCK + path, headers={'apikey': 'x'})).read())
def dock(p): return p.evaluate("getComputedStyle(document.querySelector('.nav-dock')).display") != 'none'
def login(p, email, pw='Passw0rd!'):
    p.goto(BASE); p.wait_for_timeout(700); p.fill('#authEmail', email); p.fill('#authPass', pw); p.click('#authSubmit'); p.wait_for_timeout(1300)
def fill_form(c):
    for _ in range(8):
        if c.is_visible('#reviewView'): break
        for el in c.query_selector_all('#fieldGrid [required]'):
            t = el.get_attribute('type'); tag = el.evaluate('e=>e.tagName')
            if t in ('checkbox', 'radio'): el.check()
            elif t == 'date': el.fill('2026-11-27')
            elif t == 'number': el.fill('100')
            elif t == 'email': el.fill('a@b.co')
            elif tag == 'SELECT': el.select_option(index=1)
            elif tag in ('INPUT', 'TEXTAREA'): el.fill('Test <b>x</b> Sdn Bhd')
        c.click('#nextStep'); c.wait_for_timeout(450)
        if c.is_visible('#fieldGrid') and c.inner_text('#stepEyebrow').startswith('STEP 2') and not getattr(fill_form, 'did', False):
            fill_form.did = True; c.wait_for_timeout(1500); c.reload(); c.wait_for_timeout(1500)
            ok('draft saved in Supabase: reload resumes on step 2', c.inner_text('#stepEyebrow').startswith('STEP 2'))
with sync_playwright() as pw:
    br = pw.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    errs = []; bad = []
    def mk(vp=None):
        ctx = br.new_context(viewport=vp or {"width": 1366, "height": 820}, accept_downloads=True); p = ctx.new_page()
        p.on("pageerror", lambda e: errs.append(str(e))); p.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        p.on("response", lambda r: bad.append((r.status, r.url)) if r.status >= 400 and 'supabase' not in r.url and ':54321' not in r.url and 'favicon' not in r.url else None); return ctx, p
    # 1. landing
    ctx, p = mk(); p.goto(BASE); p.wait_for_timeout(1500)
    txt = p.inner_text('body')
    ok('landing: no static/demo banner', 'STATIC' not in txt.upper() and 'demo' not in txt.lower())
    ok('landing: styled (assets resolve under /generali-oneform/)', p.evaluate("getComputedStyle(document.querySelector('.selection-card')).borderRadius") != '0px' and p.evaluate("document.querySelector('.brand-logo').naturalWidth") > 0)
    ok('landing: nav bar NOT on front page', not dock(p))
    ok('landing: Google button + Sign up tab', p.is_visible('#googleBtn') and p.is_visible('#tabSignup'))
    p.screenshot(path=SH + 'v2_login.png')
    # 2. sign up (email) -> confirm -> pending
    p.click('#tabSignup'); ok('signup tab shows name field', p.is_visible('#nameField'))
    p.fill('#authName', 'Baru Agent'); p.fill('#authEmail', 'new@test.dev'); p.fill('#authPass', 'abc'); p.click('#authSubmit'); p.wait_for_timeout(300)
    ok('short password rejected client-side', p.is_visible('#authMsg'))
    p.fill('#authPass', 'Passw0rd!'); p.click('#authSubmit'); p.wait_for_timeout(900)
    ok('signup -> "check your email" message', 'emel' in p.inner_text('#authMsg').lower())
    p.fill('#authEmail', 'new@test.dev'); p.fill('#authPass', 'Passw0rd!'); p.click('#authSubmit'); p.wait_for_timeout(900)
    ok('login blocked before email confirmed', p.is_visible('#authView') and p.is_visible('#authMsg'))
    mock('/__confirm?email=new@test.dev'); p.click('#authSubmit'); p.wait_for_timeout(1300)
    ok('new agent -> pending view, no nav', p.is_visible('#pendingView') and not dock(p))
    ctx.close()
    # 3. Google sign-up as HQ (allow-listed) -> PKCE
    ctx, p = mk(); p.goto(BASE); p.wait_for_timeout(800); p.click('#googleBtn'); p.wait_for_timeout(3500)
    ok('Google (PKCE) -> HQ dashboard', p.is_visible('#dashView') and p.is_visible('#hqTabs'))
    ok('HQ: nav bar visible inside', dock(p)); ok('code removed from URL', 'code=' not in p.url)
    p.screenshot(path=SH + 'v2_hq.png')
    p.click('#tabAgents'); p.wait_for_timeout(300)
    ok('HQ sees pending agent', 'new@test.dev' in p.inner_text('#appList'))
    p.click('[data-act=active] >> nth=0'); p.wait_for_timeout(900)
    ok('HQ approves agent', mock('/__state')['profiles'] and any(x['email'] == 'new@test.dev' and x['status'] == 'active' for x in mock('/__state')['profiles']))
    p.reload(); p.wait_for_timeout(1500); ok('session persists after reload', p.is_visible('#dashView'))
    p.click('#logoutBtn'); p.wait_for_timeout(500); ok('logout -> front page, nav hidden', p.is_visible('#authView') and not dock(p)); ctx.close()
    # 4. agent: create link
    ctx, ap = mk(); login(ap, 'agent@test.dev')
    ok('agent: dashboard + nav visible', ap.is_visible('#dashView') and dock(ap))
    ap.select_option('#linkForm', 'PI'); ap.click('#createLink'); ap.wait_for_timeout(1000)
    url = ap.input_value('#guestUrl'); ok('link = origin+path+?token=<48 hex>', re.match(re.escape(BASE) + r'\?token=[0-9a-f]{48}$', url) is not None, url[-20:])
    ap.click('#createLink'); ap.wait_for_timeout(800); url2 = ap.input_value('#guestUrl'); ok('each link unique', url != url2)
    ap.click('#createLink'); ap.wait_for_timeout(800); url3 = ap.input_value('#guestUrl')
    st = mock('/__state'); ok('only token HASH stored (raw token not in DB)', url.split('token=')[1] not in json.dumps(st))
    ap.screenshot(path=SH + 'v2_agent.png')
    # 5. customer
    cctx, c = mk(); c.goto(url); c.wait_for_timeout(2000)
    ok('customer link opens PI form without account', c.is_visible('#formView') and 'Professional Indemnity' in c.inner_text('#formTitle'))
    ok('customer: nav bar visible inside', dock(c))
    c.screenshot(path=SH + 'v2_customer.png')
    c.click('#liquidNav button >> nth=1', force=True); c.wait_for_timeout(500); ok('customer cannot open other form (toast)', 'PI' in c.inner_text('#toast'))
    fill_form(c); ok('reached review', c.is_visible('#reviewView'))
    c.click('#submitApplication'); c.wait_for_timeout(400); ok('submit blocked without signature', not c.is_visible('#doneView'))
    c.locator('#signatureCanvas').scroll_into_view_if_needed(); b = c.locator('#signatureCanvas').bounding_box(); c.mouse.move(b['x'] + 30, b['y'] + 40); c.mouse.down()
    for k in range(12): c.mouse.move(b['x'] + 30 + k * 18, b['y'] + 40 + (k % 3) * 14, steps=3)
    c.mouse.up(); c.check('#confirmAccuracy')
    with c.expect_download() as d: c.click('#downloadPdfReview')
    ok('customer PDF downloads', open(d.value.path(), 'rb').read()[:4] == b'%PDF')
    c.click('#submitApplication'); c.wait_for_timeout(1500)
    ref = c.inner_text('#referenceNo'); ok('submitted: reference shown', c.is_visible('#doneView') and re.match(r'GEN-\d{8}-[A-F0-9]{6}$', ref), ref)
    ok('XSS payload shown as text', c.evaluate("[...document.querySelectorAll('#reviewSummary b')].filter(b=>b.textContent.trim()==='x').length") == 0)
    c.reload(); c.wait_for_timeout(1500); ok('reload submitted link -> done, cannot resubmit', c.is_visible('#doneView') and not c.is_visible('#downloadPdfDone'))
    # 6. agent sees + pdf ; isolation
    ap.reload(); ap.wait_for_timeout(1500); ok('agent sees submitted + PDF button', ap.locator('[data-act=pdf]').count() == 1)
    with ap.expect_download() as d2: ap.click('[data-act=pdf]')
    pdf = open(d2.value.path(), 'rb').read(); ok('agent PDF has signature (size)', pdf[:4] == b'%PDF' and len(pdf) > 20000, f'{len(pdf)}B'); open('/home/claude/work/sample_v2.pdf', 'wb').write(pdf)
    ap.click('[data-act=revoke] >> nth=1'); ap.wait_for_timeout(900)
    rctx, r = mk(); r.goto(url2); r.wait_for_timeout(1500); ok('revoked link rejected', r.is_visible('#authView') and not dock(r)); rctx.close()
    ectx, e = mk(); apps = mock('/__state')['apps']; third = [a for a in apps if a['status'] == 'draft'][0]; mock('/__expire?id=' + third['id'])
    # find token for expired: url3 (latest) was drafted last; expire all drafts via state ids
    for a in apps:
        if a['status'] == 'draft': mock('/__expire?id=' + a['id'])
    e.goto(url3); e.wait_for_timeout(1500); ok('expired (7 days) link rejected', e.is_visible('#authView') and 'tamat' in e.inner_text('#toast')); ectx.close()
    fctx, f = mk(); f.goto(BASE + '?token=' + 'a' * 48); f.wait_for_timeout(1200); ok('forged token rejected', f.is_visible('#authView') and not dock(f)); fctx.close()
    f2ctx, f2 = mk(); f2.goto(BASE + '?token=short'); f2.wait_for_timeout(900); ok('malformed token rejected', f2.is_visible('#authView')); f2ctx.close()
    ictx, ip = mk(); login(ip, 'agent2@test.dev'); ok("other agent sees none of agent 1's applications", ip.locator('.app-row').count() == 0); ictx.close()
    hctx, h = mk(); login(h, 'hq@test.dev'); ok('HQ sees all applications + agent name', h.locator('.app-row').count() >= 1 and 'Ejen Ali' in h.inner_text('#appList')); hctx.close()
    # 7. language + mobile
    ap.click('#langBtn'); ap.wait_for_timeout(300); ok('EN toggle translates dashboard', 'Create customer link' in ap.inner_text('#dashView'))
    ctx.close(); cctx.close()
    mctx, m = mk({"width": 390, "height": 800}); m.goto(BASE); m.wait_for_timeout(1200)
    ok('mobile: no overflow, nav hidden on front page', m.evaluate("document.documentElement.scrollWidth<=innerWidth") and not dock(m)); m.screenshot(path=SH + 'v2_mobile_login.png')
    login(m, 'agent@test.dev'); ok('mobile: nav at bottom after login', dock(m)); m.screenshot(path=SH + 'v2_mobile_agent.png')
    print('HTTP>=400 (non-mock):', bad); print('console errors:', [x for x in errs if '400' not in x and '401' not in x][:6])
    br.close()
print(sum(res), '/', len(res), 'passed')
