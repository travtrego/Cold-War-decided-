from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle

OUT = Path(__file__).resolve().parents[1] / "output" / "pdf"
OUT.mkdir(parents=True, exist_ok=True)

SCENARIOS = [
    {
        "file": "operation-northern-glass.pdf",
        "title": "OPERATION NORTHERN GLASS",
        "date": "08 FEB 1984",
        "brief": "NATO sensors detect unusual Soviet activity across the Norwegian Sea during a major winter exercise. A submarine contact, intermittent radar emissions, a high-altitude aircraft, and conflicting human reports may describe one coordinated operation or several unrelated tests.",
        "objective": "Determine whether the activity is preparation for a strategic strike, a deception operation, or routine experimentation. Recommend one NATO response that protects readiness without causing unnecessary escalation.",
        "submarine": [
            "[p. 2] A Victor-class attack submarine left its normal exercise box twelve hours early and moved toward a NATO acoustic-array maintenance corridor.",
            "[p. 2] The contact slowed below five knots, crossed behind a seamount, and was lost for forty-seven minutes.",
            "[p. 2] Hydrophones detected two short metallic transients before contact loss. Analysts cannot distinguish equipment deployment from normal hull noise.",
            "[p. 2] No torpedo-door noise, emergency traffic, explosion, or distress signal was detected.",
            "You have no access to ELINT, aircraft, or HUMINT reporting.",
        ],
        "elint": [
            "[p. 2] A Soviet coastal radar used a narrow-beam tracking mode on three NATO patrol routes, but each illumination lasted under nine seconds.",
            "[p. 2] The emitter changed frequency according to a pattern not present in the NATO reference library.",
            "[p. 2] Two bursts occurred while no NATO aircraft was inside the radar's expected line of sight.",
            "[p. 2] Maintenance calibration, anti-jamming trials, and deliberate signaling remain viable explanations.",
            "You have no access to submarine, aircraft, or HUMINT reporting.",
        ],
        "air": [
            "[p. 3] A modified Tu-95 flew north without its normal tanker support and approached the Greenland-Iceland-UK gap.",
            "[p. 3] Reconnaissance images show two unfamiliar pods beneath the wings; resolution is insufficient to identify weapons or sensors.",
            "[p. 3] The aircraft turned away immediately after a NATO fighter radar acquired it and never crossed sovereign airspace.",
            "[p. 3] Its route overlapped the radar illumination area but not the last confirmed submarine position.",
            "You have no access to submarine, ELINT, or HUMINT reporting.",
        ],
        "humint": [
            "[p. 3] A reliable dockworker reports that technicians loaded cable-handling equipment onto the submarine tender before departure.",
            "[p. 3] A new source claiming access to Northern Fleet plans says the operation is a rehearsal for cutting NATO seabed sensors. The source has not been independently verified.",
            "[p. 3] A diplomatic contact heard that Moscow expects NATO to overreact to a deliberately visible exercise.",
            "[p. 3] The new source and diplomatic contact may both have received information from the same Soviet briefing officer.",
            "You have no access to submarine, ELINT, or aircraft reporting.",
        ],
    },
    {
        "file": "operation-amber-circuit.pdf",
        "title": "OPERATION AMBER CIRCUIT",
        "date": "21 JUN 1982",
        "brief": "A Warsaw Pact communications exercise in the Baltic coincides with a missing submarine contact, mobile radar activity, an aircraft incursion, and reports of an unauthorized command network. NATO must decide whether this is coup preparation, strategic deception, or a fragmented readiness drill.",
        "objective": "Assess whether a rogue command group is attempting to create an independent launch capability. Recommend the safest action that tests the hypothesis while preserving NATO warning capacity.",
        "submarine": [
            "[p. 2] A Whiskey-class signals-intelligence submarine halted near an undersea communications junction used by Warsaw Pact naval units.",
            "[p. 2] NATO lost the contact after heavy merchant traffic entered the area; a second faint contact later moved east at commercial speed.",
            "[p. 2] The submarine carried no known ballistic missiles and had recently completed antenna repairs.",
            "[p. 2] Analysts disagree whether it was monitoring the junction, repairing a fault, or serving as a covert relay.",
            "You have no access to ELINT, aircraft, or HUMINT reporting.",
        ],
        "elint": [
            "[p. 2] Three mobile air-defense radars activated in sequence without using the normal regional command preamble.",
            "[p. 2] One station transmitted an obsolete authentication burst last used eighteen months earlier.",
            "[p. 2] The activation chain ended before any weapons-guidance radar achieved a stable track.",
            "[p. 2] The pattern could indicate a backup command circuit, an exercise inject, operator error, or spoofing.",
            "You have no access to submarine, aircraft, or HUMINT reporting.",
        ],
        "air": [
            "[p. 3] An East German transport aircraft crossed a restricted Polish training zone without the scheduled transponder code.",
            "[p. 3] It descended near a reserve command bunker, remained on the ground for eleven minutes, and returned by a different route.",
            "[p. 3] Photography shows cargo doors open but cannot identify passengers or equipment.",
            "[p. 3] Weather diversions were active elsewhere, but this airfield was reporting safe conditions.",
            "You have no access to submarine, ELINT, or HUMINT reporting.",
        ],
        "humint": [
            "[p. 3] A long-standing military source says several communications officers were abruptly reassigned to an unscheduled exercise cell.",
            "[p. 3] A frightened walk-in claims a general intends to demonstrate control of a regional launch network. The walk-in provides no documents and requests money.",
            "[p. 3] A monitored party official described the activity as an inspection ordered after repeated communications failures.",
            "[p. 3] The military source and party official are independent; the walk-in's access is unknown.",
            "You have no access to submarine, ELINT, or aircraft reporting.",
        ],
    },
    {
        "file": "operation-copper-lantern.pdf",
        "title": "OPERATION COPPER LANTERN",
        "date": "03 OCT 1985",
        "brief": "During Black Sea fleet maneuvers, NATO observes a submarine rendezvous, coastal tracking bursts, an unusual cargo flight, and reports involving a third-country intelligence service. The pattern may signal covert technology transfer, a counterintelligence trap, or preparations for regional coercion.",
        "objective": "Determine the most likely purpose of the coordinated activity and whether NATO should expose, monitor, or disrupt it. Identify the evidence that would most change the assessment.",
        "submarine": [
            "[p. 2] A Soviet diesel submarine surfaced at night outside its declared exercise lane and met a civilian-registered support vessel for twenty-three minutes.",
            "[p. 2] Infrared imagery shows a crane moving one container-sized object toward the submarine, but cloud obscures the final position.",
            "[p. 2] The submarine later resumed its published exercise route and transmitted a routine machinery-status message.",
            "[p. 2] The support vessel has previously serviced oceanographic projects and naval auxiliaries.",
            "You have no access to ELINT, aircraft, or HUMINT reporting.",
        ],
        "elint": [
            "[p. 2] Coastal tracking radars illuminated the rendezvous area in short alternating sectors rather than maintaining continuous coverage.",
            "[p. 2] A low-power burst used a modulation associated with Soviet range-safety beacons, not combat guidance.",
            "[p. 2] One radar shut down six minutes before the civilian vessel arrived and resumed immediately after departure.",
            "[p. 2] The gap could be deliberate concealment, equipment cooling, or a scheduled handoff between stations.",
            "You have no access to submarine, aircraft, or HUMINT reporting.",
        ],
        "air": [
            "[p. 3] An An-12 cargo aircraft arrived from a third country and parked in a screened military apron for ninety minutes.",
            "[p. 3] The aircraft departed lighter according to runway-performance estimates, though wind uncertainty makes the weight calculation imprecise.",
            "[p. 3] A Soviet helicopter flew from the same airfield toward the coast but disappeared below radar coverage.",
            "[p. 3] No direct track connects the helicopter to the submarine rendezvous.",
            "You have no access to submarine, ELINT, or HUMINT reporting.",
        ],
        "humint": [
            "[p. 3] A proven customs source says the foreign aircraft manifest listed oceanographic instruments with serial numbers that do not match the crates observed.",
            "[p. 3] A suspected double agent claims the Soviets are transferring a quiet-propulsion prototype to the third country.",
            "[p. 3] A separate embassy source reports the third country is returning defective sonar equipment purchased the previous year.",
            "[p. 3] The double agent knew the rendezvous date unusually early, raising the possibility of a controlled leak.",
            "You have no access to submarine, ELINT, or aircraft reporting.",
        ],
    },
]

styles = getSampleStyleSheet()
title_style = ParagraphStyle("Title", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=24, leading=28, textColor=colors.HexColor("#17362F"), alignment=TA_CENTER, spaceAfter=14)
label_style = ParagraphStyle("Label", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=colors.HexColor("#17362F"), spaceBefore=9, spaceAfter=6)
body_style = ParagraphStyle("Body", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.8, leading=13.5, textColor=colors.HexColor("#17201D"), spaceAfter=6)
small_style = ParagraphStyle("Small", parent=body_style, fontSize=8.5, leading=11, textColor=colors.HexColor("#52625D"))

def add_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.HexColor("#17362F"))
    canvas.rect(0, LETTER[1] - 0.28 * inch, LETTER[0], 0.28 * inch, stroke=0, fill=1)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#52625D"))
    canvas.drawString(0.7 * inch, 0.42 * inch, "ORPHEUS DIRECTORATE // FICTIONAL TRAINING SCENARIO")
    canvas.drawRightString(LETTER[0] - 0.7 * inch, 0.42 * inch, f"PAGE {doc.page}")
    canvas.restoreState()

def dossier_block(marker, items):
    rows = [[Paragraph(f"- {item}", body_style)] for item in items]
    table = Table(rows, colWidths=[7.05 * inch], splitByRow=1)
    table.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return [Paragraph(marker, label_style), table]

for scenario in SCENARIOS:
    path = OUT / scenario["file"]
    doc = SimpleDocTemplate(str(path), pagesize=LETTER, rightMargin=0.72*inch, leftMargin=0.72*inch, topMargin=0.62*inch, bottomMargin=0.72*inch,
                            title=scenario["title"], author="Orpheus Directorate Training System")
    story = [Spacer(1, 0.28*inch), Paragraph(scenario["title"], title_style),
             Paragraph(f"SCENARIO TITLE: {scenario['title']}", small_style),
             Paragraph(f"DATE: {scenario['date']}", small_style), Spacer(1, 0.18*inch),
             Paragraph("DIRECTOR BRIEF:", label_style), Paragraph(scenario["brief"], body_style),
             Paragraph("OBJECTIVE:", label_style), Paragraph(scenario["objective"], body_style),
             Spacer(1, 0.2*inch), Paragraph("HANDLING NOTE", label_style),
             Paragraph("This document contains fictional facts for a multi-agent training game. Each marked dossier is routed only to its named specialist. Facts should not be supplemented with outside knowledge.", body_style),
             PageBreak()]
    story.extend(dossier_block("[SUBMARINE DOSSIER]", scenario["submarine"]))
    story.extend(dossier_block("[ELINT DOSSIER]", scenario["elint"]))
    story.append(PageBreak())
    story.extend(dossier_block("[AIR DOSSIER]", scenario["air"]))
    story.extend(dossier_block("[HUMINT DOSSIER]", scenario["humint"]))
    story.append(Paragraph("[END DOSSIER]", label_style))
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("END OF FICTIONAL SCENARIO", small_style))
    doc.build(story, onFirstPage=add_page, onLaterPages=add_page)
    print(path)
