#!/usr/bin/env python3
"""
KickerCoach - Automatisierte Test-Suite für das Trainingsmodul
Überprüft 10 Kern-Qualitätskriterien nach jeder Code-Anpassung.
"""

import os
import re
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AI_SERVICE_PATH = os.path.join(BASE_DIR, 'js', 'ai-service.js')
PITCH_RENDERER_PATH = os.path.join(BASE_DIR, 'js', 'pitch-renderer.js')
TRAINING_JS_PATH = os.path.join(BASE_DIR, 'js', 'training.js')
INDEX_HTML_PATH = os.path.join(BASE_DIR, 'index.html')
APP_JS_PATH = os.path.join(BASE_DIR, 'js', 'app.js')
STYLES_CSS_PATH = os.path.join(BASE_DIR, 'css', 'styles.css')

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

test_results = []

def run_test(name, fn):
    print(f"{Colors.BLUE}[TEST]{Colors.RESET} {name}...", end=' ')
    try:
        fn()
        print(f"{Colors.GREEN}✓ BESTANDEN{Colors.RESET}")
        test_results.append((name, True, ""))
    except AssertionError as e:
        print(f"{Colors.RED}✗ FEHLGESCHLAGEN: {e}{Colors.RESET}")
        test_results.append((name, False, str(e)))
    except Exception as e:
        print(f"{Colors.RED}✗ FEHLER: {e}{Colors.RESET}")
        test_results.append((name, False, f"Exception: {e}"))

# -------------------------------------------------------------
# 1. Inhalts-Dynamik: Verändern sich die Inhalte der 4 Phasen?
# -------------------------------------------------------------
def test_1_content_dynamics():
    with open(AI_SERVICE_PATH, 'r', encoding='utf-8') as f:
        code = f.read()

    # Extrahiere Übungstitel
    titles = re.findall(r"title:\s*['\"]([^'\"]+)['\"]", code)
    assert len(titles) >= 32, f"Erwartet mindestens 32 Phasen-Titel, gefunden: {len(titles)}"

    # Prüfe, dass Phasen-Titel nicht starr identisch sind
    phase_titles = [t for t in titles if not t.startswith('Trainingseinheit') and not t.startswith('DFB') and not 'Plan' in t]
    unique_titles = set(phase_titles)
    ratio = len(unique_titles) / max(len(phase_titles), 1)
    assert ratio >= 0.75, f"Zu viele identische Übungstitel! Unique Ratio: {ratio:.2f} (erwartet >= 0.75)"

# -------------------------------------------------------------
# 2. Detailtiefe der Beschreibungen: Sind Organisation & Ablauf strukturiert?
# -------------------------------------------------------------
def test_2_description_depth():
    with open(AI_SERVICE_PATH, 'r', encoding='utf-8') as f:
        code = f.read()

    # Organisationen (auch mit Newlines und Quotes)
    org_pattern = r"organization:\s*(?:'([^']*(?:\\.[^']*)*)'|\"([^\"\\]*(?:\\.[^\"\\]*)*)\"|`([^`\\]*(?:\\.[^`\\]*)*)`)"
    org_matches = re.findall(org_pattern, code)
    orgs = [m[0] or m[1] or m[2] for m in org_matches if (m[0] or m[1] or m[2])]
    assert len(orgs) >= 32, f"Zu wenige organization-Einträge gefunden: {len(orgs)}"

    # Prüfe Mindestlänge und Schlüsselwörter für Organisation
    short_orgs = [o for o in orgs if len(o.strip()) < 40 and not 'DFB' in o]
    assert len(short_orgs) == 0, f"{len(short_orgs)} Organisationstexte sind zu kurz (< 40 Zeichen): {short_orgs[:2]}"

    # Ablauf und Spielregeln
    rules_pattern = r"drillRules:\s*(?:'([^']*(?:\\.[^']*)*)'|\"([^\"\\]*(?:\\.[^\"\\]*)*)\"|`([^`\\]*(?:\\.[^`\\]*)*)`)"
    rule_matches = re.findall(rules_pattern, code)
    rules = [m[0] or m[1] or m[2] for m in rule_matches if (m[0] or m[1] or m[2])]
    assert len(rules) >= 32, f"Zu wenige drillRules-Einträge gefunden: {len(rules)}"

    # Prüfe Strukturierung mit Schritten (1. Start, 2. Ablauf, etc.)
    structured_rules = [r for r in rules if ('1. Start' in r or '1. Ablauf' in r or '1. Aufbau' in r)]
    assert len(structured_rules) >= 25, f"Zu wenige strukturierte Schritt-für-Schritt Regeln! Erwartet >= 25, gefunden: {len(structured_rules)}"

# -------------------------------------------------------------
# 3. Taktiktafel-Grafik: Entspricht das Layout dem Inhalt?
# -------------------------------------------------------------
def test_3_pitch_tactics_layouts():
    with open(PITCH_RENDERER_PATH, 'r', encoding='utf-8') as f:
        pr = f.read()

    # Überprüfe Vorhandensein der 24 Layout-Generatoren
    required_layouts = [
        # Warmup
        'getWarmupHütchenwaldLayout', 'getWarmupFangspielLayout', 'getWarmupFarbenEckenLayout', 'getWarmupInselLayout',
        # Koordination
        'getCoordinationReifenHuerdenLayout', 'getCoordinationSlalomParcoursLayout', 'getCoordinationKreuzLayout', 'getCoordinationHuerdenSprintLayout',
        # Torschuss
        'getShootingJugendtorLayout', 'getShootingDoppelStationLayout', 'getShootingKombinationLayout',
        # Passspiel
        'getPassingDreieckeLayout', 'getPassingDoppelpassLayout', 'getPassingRauteLayout',
        # 1-gegen-1
        'getOneVsOneFrontalLayout', 'getOneVsOneSeitlichLayout', 'getOneVsOneDoppelDuellLayout',
        # Dribbling
        'getDribblingHütchentoreLayout', 'getDribblingSlalomKonterLayout', 'getDribblingZonenLayout',
        # Funino
        'getFuninoStandardLayout', 'getFuninoJokerLayout', 'getFuninoDiagonaltoreLayout', 'getFuninoFestivalLayout'
    ]

    for l in required_layouts:
        assert l in pr, f"Fehlendes Taktik-Layout in pitch-renderer.js: {l}"

    # Überprüfe, dass renderPitch die Options weiterleitet
    assert 'this.detectOrGetLayout(drill, options)' in pr, "renderPitch leitet options nicht an detectOrGetLayout weiter!"

# -------------------------------------------------------------
# 4. Legenden-Synchronität: Passen Legende und Spielfeldelemente zusammen?
# -------------------------------------------------------------
def test_4_legend_coherence():
    with open(PITCH_RENDERER_PATH, 'r', encoding='utf-8') as f:
        pr = f.read()

    # Prüfe Legenden-Builder
    assert 'getLegend(layout = {})' in pr or 'getLegend(layout)' in pr, "getLegend(layout) fehlt in pitch-renderer.js"

    # Prüfe realistische Mini-Vektoren und Beschriftungen in Legende
    expected_labels = ['Jugendtor', 'Minitor', 'Hütchen', 'Reifen', 'Minihürde', 'Slalomstange', 'Torwart', 'Dribbling', 'Pass', 'Torschuss']
    for label in expected_labels:
        assert label in pr, f"Legenden-Label fehlt: {label}"

    # Prüfe SVG-Klasse der Legenden-Icons
    assert 'legend-icon-svg' in pr, "legend-icon-svg Klasse fehlt für getreue Mini-SVGs in der Legende"

# -------------------------------------------------------------
# 5. Trainerschwerpunkt-Durchgängigkeit (Schuss, Pass, 1v1, Dribbling)
# -------------------------------------------------------------
def test_5_custom_focus_adaptation():
    with open(AI_SERVICE_PATH, 'r', encoding='utf-8') as f:
        ai = f.read()

    # Prüfe Schusstechnik-Adaption
    assert 'Torschuss & Schusstechnik' in ai or 'Torschuss-Könige' in ai, "Schusstechnik-Adaption fehlt in ai-service.js"
    assert 'schwachen Fuß zählen doppelt' in ai, "Sonderregel für schwachen Fuß fehlt bei Torschuss-Fokus"

    # Prüfe Passspiel-Adaption
    assert 'Pass-Dreiecke' in ai or 'Pass-Freunde' in ai, "Passspiel-Adaption fehlt in ai-service.js"

    # Prüfe 1-gegen-1-Adaption
    assert '1-gegen-1 Duell' in ai, "1-gegen-1 Adaption fehlt in ai-service.js"

    # Prüfe Dribbling-Adaption
    assert 'Tempodribbling & Hütchentor-Jagd' in ai, "Dribbling-Adaption fehlt in ai-service.js"

# -------------------------------------------------------------
# 6. Einheiten-Integrität (1 vs. 2 vs. 4 Wochen)
# -------------------------------------------------------------
def test_6_unit_count_integrity():
    with open(AI_SERVICE_PATH, 'r', encoding='utf-8') as f:
        ai = f.read()

    # Prüfe Logik für Einzeleinheit (weeksCount = 1)
    assert 'const targetUnitsCount = count === 1 ? 1 : count === 2 ? 4 : 8;' in ai, "targetUnitsCount Logik für 1, 2 oder 4 Wochen fehlerhaft!"
    assert 'isSingleUnit = count === 1;' in ai or 'count === 1 ? 1' in ai, "Einzeltrainings-Erkennung fehlt in ai-service.js"

    with open(TRAINING_JS_PATH, 'r', encoding='utf-8') as f:
        tr = f.read()
    assert 'unit-pill-single' in tr or '1 Trainingseinheit' in tr or 'isSingleUnit' in tr, "Dynamische Einzeleinheit-Darstellung fehlt in training.js"

# -------------------------------------------------------------
# 7. Vereins-Code Sicherheit (Nicht vorbelegt vor Eingabe)
# -------------------------------------------------------------
def test_7_access_code_not_prefilled():
    with open(INDEX_HTML_PATH, 'r', encoding='utf-8') as f:
        html = f.read()

    assert 'id="trainer-code-input"' in html, "trainer-code-input Element fehlt in index.html"
    assert 'value="kicker2026"' not in html, "FEHLER: kicker2026 ist in index.html fest als value vorbelegt!"

    with open(APP_JS_PATH, 'r', encoding='utf-8') as f:
        app = f.read()

    assert "codeInput.value = currentCode || '';" in app, "codeInput wird in app.js mit einem Fallback vorbelegt statt leer zu bleiben!"

# -------------------------------------------------------------
# 8. Offline- & Fallback-Resilienz
# -------------------------------------------------------------
def test_8_offline_fallback_resilience():
    with open(AI_SERVICE_PATH, 'r', encoding='utf-8') as f:
        ai = f.read()

    assert 'parseJsonSafe(rawText, fallbackParams = null)' in ai, "parseJsonSafe Signatur fehlerhaft"
    assert 'return this.getAdaptedPlan(fallbackParams);' in ai, "Automatischer Fallback zu getAdaptedPlan fehlt in parseJsonSafe"
    assert 'getMasterPlan' in ai, "getMasterPlan fehlt in ai-service.js"

# -------------------------------------------------------------
# 9. DFB-Standzeiten-Check für 16–20 Kinder
# -------------------------------------------------------------
def test_9_waiting_time_prevention():
    with open(AI_SERVICE_PATH, 'r', encoding='utf-8') as f:
        ai = f.read()

    # Prüfe ob parallele Zonen/Stationen in den Beschreibungen erwähnt sind
    keywords = ['parallel', 'Station', 'Zone', 'Felder', 'minimale Wartezeit', 'Gruppen']
    match_count = sum(1 for kw in keywords if kw.lower() in ai.lower())
    assert match_count >= 5, f"Zu wenige Organisations-Hinweise für parallele Stationen (Gefunden: {match_count})"

# -------------------------------------------------------------
# 10. CSS & Responsive Formatierung
# -------------------------------------------------------------
def test_10_css_formatting():
    with open(STYLES_CSS_PATH, 'r', encoding='utf-8') as f:
        css = f.read()

    # Prüfe white-space pre-line für Phasen-Beschreibungen
    phase_item_match = re.search(r'\.phase-detail-item\s+p\s*\{([^}]+)\}', css)
    assert phase_item_match, ".phase-detail-item p fehlt in styles.css"
    assert 'white-space: pre-line;' in phase_item_match.group(1), ".phase-detail-item p muss 'white-space: pre-line;' haben!"

    pitch_box_match = re.search(r'\.pitch-inst-box\s+p\s*\{([^}]+)\}', css)
    assert pitch_box_match, ".pitch-inst-box p fehlt in styles.css"
    assert 'white-space: pre-line;' in pitch_box_match.group(1), ".pitch-inst-box p muss 'white-space: pre-line;' haben!"

# -------------------------------------------------------------
# Main Runner
# -------------------------------------------------------------
def main():
    print(f"\n{Colors.BOLD}======================================================{Colors.RESET}")
    print(f"{Colors.BOLD}  KickerCoach - Qualitätssicherungs-Testsuite (10 Tests) {Colors.RESET}")
    print(f"{Colors.BOLD}======================================================{Colors.RESET}\n")

    run_test("1. Inhalts-Dynamik (4 Phasen, 8 Einheiten)", test_1_content_dynamics)
    run_test("2. Detailtiefe der Beschreibungen (Start, Ablauf, Wertung, Rotation)", test_2_description_depth)
    run_test("3. Taktiktafel-Grafiken (24 dynamische Layouts)", test_3_pitch_tactics_layouts)
    run_test("4. Legenden-Synchronität (Symbol-Abgleich)", test_4_legend_coherence)
    run_test("5. Trainerschwerpunkt-Durchgängigkeit (Schuss, Pass, 1v1, Dribbling)", test_5_custom_focus_adaptation)
    run_test("6. Einheiten-Integrität (1 vs. 2 vs. 4 Wochen)", test_6_unit_count_integrity)
    run_test("7. Vereins-Code Sicherheit (Nicht vorbelegt vor Eingabe)", test_7_access_code_not_prefilled)
    run_test("8. Offline- & Fallback-Resilienz (getAdaptedPlan)", test_8_offline_fallback_resilience)
    run_test("9. DFB-Standzeiten-Check (Parallele Stationen für 16–20 Kinder)", test_9_waiting_time_prevention)
    run_test("10. CSS & Responsive Formatierung (white-space: pre-line)", test_10_css_formatting)

    print(f"\n{Colors.BOLD}======================================================{Colors.RESET}")
    passed = sum(1 for _, s, _ in test_results if s)
    failed = sum(1 for _, s, _ in test_results if not s)

    if failed == 0:
        print(f"{Colors.GREEN}{Colors.BOLD}✓ ALLE {passed} TESTS ERFOLGREICH BESTANDEN!{Colors.RESET}\n")
        sys.exit(0)
    else:
        print(f"{Colors.RED}{Colors.BOLD}✗ {failed} VON {len(test_results)} TESTS FEHLGESCHLAGEN!{Colors.RESET}\n")
        sys.exit(1)

if __name__ == '__main__':
    main()
