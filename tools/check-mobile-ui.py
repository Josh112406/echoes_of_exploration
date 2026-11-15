"""AI-assisted browser regression check. Run against a local Vite server.

Usage: python tools/check-mobile-ui.py [http://127.0.0.1:5173]
Requires Python Playwright and Chrome.
"""
import sys
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5173"
with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    for width, height, mobile in [(320, 568, True), (390, 844, True), (568, 320, True), (980, 326, True), (1366, 768, False)]:
        context = browser.new_context(viewport={"width": width, "height": height}, is_mobile=mobile, has_touch=mobile)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(url, wait_until="networkidle")
        page.wait_for_function("window.__PHASER_GAME__?.isRunning")
        page.evaluate("""async () => {
            const {GameState} = await import('/src/core/GameState.ts');
            GameState.setPrologueSeen(true);
        }""")
        page.reload(wait_until="networkidle")
        page.wait_for_function("window.__PHASER_GAME__?.isRunning")
        page.evaluate("""() => {
            const g = window.__PHASER_GAME__;
            g.scene.getScenes(true).forEach(s => g.scene.stop(s.scene.key));
            document.querySelectorAll('.overlay-pane').forEach(e => e.classList.add('hidden'));
            g.scene.start('SiteScene');
        }""")
        page.wait_for_function("window.__PHASER_GAME__.scene.getScene('SiteScene').robot")
        # Phones held upright are asked to rotate first; carry on upright for this check
        if mobile and height > width:
            assert page.locator('#rotate-prompt').is_visible()
            page.locator('#rotate-dismiss').tap()
            assert not page.locator('#rotate-prompt').is_visible()
        elif mobile:
            assert not page.locator('#rotate-prompt').is_visible()
        if mobile:
            assert not page.locator('.mobile-joystick-label').is_visible()
            box = page.locator('#mobile-site-actions').bounding_box()
            stick = page.locator('#mobile-joystick').bounding_box()
            assert box and stick and width - box['x'] - box['width'] >= 23
            assert stick['x'] + stick['width'] < box['x']
            page.locator('#mobile-map').tap()
            assert page.locator('.exploration-nav__you').is_visible()
            page.locator('#btn-close-hub').tap()
            assert not page.locator('#hub-overlay').is_visible()
        else:
            assert not page.locator('#mobile-game-controls').is_visible()

        # Positions use the same dimensions as exploration, for all three sectors.
        assert page.evaluate("""async () => {
            const {HubMap} = await import('/src/ui/HubMap.ts');
            const {GameState} = await import('/src/core/GameState.ts');
            const host = document.createElement('div');
            const map = new HubMap(host);
            for (const [world, count] of [['moon',8], ['mars',9], ['elsewhere',6]]) {
                GameState.getState().currentWorld = world;
                GameState.setRobotPosition(world, {x:1200,y:800});
                map.render();
                const you = host.querySelector('.exploration-nav__you');
                if (you.style.left !== '50%' || you.style.top !== '50%' || host.querySelectorAll('.exploration-nav__site').length !== count) return false;
                delete GameState.getState().robotPositions[world];
                map.render();
                if (host.querySelector('.exploration-nav__you')) return false;
            }
            GameState.getState().currentWorld = 'moon';
            return true;
        }""")

        page.evaluate("""async () => {
            const {EntryReaderModal} = await import('/src/ui/EntryReaderModal.ts');
            const reader = new EntryReaderModal(document.querySelector('#entry-overlay'));
            reader.open('surveyor-3', 'browse');
            reader.showPage(1, false);
            window.testReader = reader;
        }""")
        if mobile:
            assert page.locator('.briefing__p').first.evaluate("e => parseFloat(getComputedStyle(e).fontSize)") >= 16
            assert page.locator('.briefing__card').evaluate("e => e.scrollHeight <= e.clientHeight + 2")
            assert page.locator('#entry-overlay').evaluate("e => getComputedStyle(e).overflowY") == 'auto'
            page.locator('#btn-reel-next').scroll_into_view_if_needed()
            assert page.locator('#btn-reel-next').is_visible()
            page.evaluate("window.testReader.showPage(2, false)")
            assert page.locator('#entry-overlay').evaluate('e => e.scrollTop') == 0
        page.evaluate("""() => {
            document.querySelector('#entry-overlay').classList.add('hidden');
            const g = window.__PHASER_GAME__;
            g.scene.getScenes(true).forEach(s => g.scene.stop(s.scene.key));
            g.scene.start('LandingScene', {siteId:'surveyor-3'});
        }""")
        page.wait_for_function("window.__PHASER_GAME__.scene.getScene('LandingScene').uiLayer")
        sizes = page.evaluate("""() => {
            const scene = window.__PHASER_GAME__.scene.getScene('LandingScene');
            const zones = scene.uiLayer.list.filter(e => e.type === 'Zone' && e.y > 250 && e.input);
            const scale = scene.scale.displaySize.width / 640;
            return zones.map(e => ({width:e.width, height:e.height, screenHeight:e.height * scale}));
        }""")
        assert len(sizes) == 3, sizes
        assert all(s['screenHeight'] >= 52 if mobile else s['height'] >= 24 for s in sizes), sizes
        assert any(s['width'] == (180 if mobile else 150) for s in sizes), sizes
        if mobile:
            page.locator('.mobile-briefing').evaluate_all('elements => elements.forEach(e => e.remove())')
            points = page.evaluate("""() => {
                const scene = window.__PHASER_GAME__.scene.getScene('LandingScene');
                const rect = scene.game.canvas.getBoundingClientRect();
                return scene.uiLayer.list.filter(e => e.type === 'Zone' && e.y > 250 && e.input).map(e => ({x:rect.x + e.x * rect.width / 640, y:rect.y + e.y * rect.height / 360}));
            }""")
            cdp = context.new_cdp_session(page)
            for i, point in enumerate(points):
                cdp.send('Input.dispatchTouchEvent', {'type':'touchStart', 'touchPoints':[point]})
                page.wait_for_function("""i => {
                    const s = window.__PHASER_GAME__.scene.getScene('LandingScene');
                    return i === 2 ? s.touchThrust : s.touchSteer === (i === 0 ? -1 : 1);
                }""", arg=i)
                cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd', 'touchPoints':[]})
                page.wait_for_function("""() => {
                    const s = window.__PHASER_GAME__.scene.getScene('LandingScene');
                    return !s.touchThrust && s.touchSteer === 0;
                }""")
        assert not errors, errors
        print(f'PASS {width}x{height}: controls, location map, facts, thruster targets', flush=True)
        context.close()
    browser.close()
