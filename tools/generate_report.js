const fs = require("fs");
const nodePath = require("path");
const {
  Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, BorderStyle, Header, Footer, PageNumber, TableOfContents, NumberFormat,
  LevelFormat, VerticalAlign, ShadingType, PageBreak, TabStopType, TabStopPosition, ImageRun,
} = require("docx");

// Resolved relative to this script's own location, not the caller's cwd,
// so `node tools/generate_report.js` works the same from anywhere.
const image = (relPath, w, h) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 100 },
    children: [new ImageRun({ data: fs.readFileSync(nodePath.join(__dirname, relPath)), transformation: { width: w, height: h }, type: "png" })],
  });

// ---------- constants matching the mandated format ----------
const FONT = "Times New Roman";
const SZ_CHAPTER = 32; // 16pt bold
const SZ_HEADING = 28; // 14pt bold
const SZ_BODY = 24;    // 12pt
const SZ_TABLE = 20;   // 10pt
const LINE_1_5 = 360;  // 1.5 line spacing
const MARGIN = { top: 1440, bottom: 1440, right: 1440, left: 2160 }; // 1" / 1" / 1" / 1.5"
const A4 = { width: 11906, height: 16838 };

// ---------- small helpers ----------
const body = (text, opts = {}) =>
  new Paragraph({
    alignment: opts.align || AlignmentType.JUSTIFIED,
    spacing: { line: LINE_1_5, lineRule: "auto", after: 160, ...(opts.spacing || {}) },
    indent: opts.indent,
    children: Array.isArray(text)
      ? text
      : [new TextRun({ text, font: FONT, size: SZ_BODY, bold: opts.bold, italics: opts.italics })],
  });

const run = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size || SZ_BODY, bold: o.bold, italics: o.italics });

const chapterTitle = (num, title) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    spacing: { line: LINE_1_5, lineRule: "auto", before: 200, after: 300 },
    children: [new TextRun({ text: `CHAPTER ${num}: ${title.toUpperCase()}`, font: FONT, size: SZ_CHAPTER, bold: true })],
  });

const heading = (text, level = HeadingLevel.HEADING_2) =>
  new Paragraph({
    heading: level,
    spacing: { line: LINE_1_5, lineRule: "auto", before: 240, after: 160 },
    children: [new TextRun({ text, font: FONT, size: SZ_HEADING, bold: true })],
  });

const bullet = (text) =>
  new Paragraph({
    numbering: { reference: "bullet-list", level: 0 },
    spacing: { line: LINE_1_5, lineRule: "auto", after: 100 },
    children: [new TextRun({ text, font: FONT, size: SZ_BODY })],
  });

const caption = (label, text) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: 240, lineRule: "auto", before: 100, after: 300 },
    children: [new TextRun({ text: `${label}: ${text}`, font: FONT, size: SZ_TABLE, bold: true })],
  });

const placeholderFigure = (label, desc) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 600, after: 600 },
                children: [run(`[ ${label} — insert screenshot here ]`, { size: SZ_TABLE, italics: true })],
              }),
            ],
            shading: { type: ShadingType.CLEAR, fill: "F2F2F2" },
          }),
        ],
      }),
    ],
  });

const cellText = (text, o = {}) =>
  new TableCell({
    width: o.width,
    verticalAlign: VerticalAlign.CENTER,
    shading: o.shade ? { type: ShadingType.CLEAR, fill: "D9D9D9" } : undefined,
    children: [
      new Paragraph({
        spacing: { line: 240, lineRule: "auto" },
        children: [new TextRun({ text, font: FONT, size: SZ_TABLE, bold: o.bold })],
      }),
    ],
  });

const simpleTable = (headerRow, rows, colWidths) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: colWidths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headerRow.map((h, i) => cellText(h, { bold: true, shade: true, width: { size: colWidths[i], type: WidthType.DXA } })),
      }),
      ...rows.map(
        (r) => new TableRow({ children: r.map((c, i) => cellText(c, { width: { size: colWidths[i], type: WidthType.DXA } })) })
      ),
    ],
  });

// reference entry: hanging indent, single-spaced within, extra space after (double-space between)
const ref = (n, text) =>
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { left: 720, hanging: 720 },
    spacing: { line: 240, lineRule: "auto", after: 240 },
    children: [run(`[${n}]\t${text}`, { size: SZ_BODY })],
  });

// ---------- FRONT MATTER: SECTION 1 (title page, no footer) ----------
const titlePageChildren = [
  new Paragraph({ spacing: { before: 1200 }, alignment: AlignmentType.CENTER, children: [run("REAL-TIME FRAUD DETECTION SMART GLASSES", { size: 36, bold: true })] }),
  new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER, children: [run("Capstone Project Report", { size: SZ_HEADING, bold: true })] }),
  new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.CENTER, children: [run("MID SEMESTER EVALUATION", { size: SZ_HEADING, bold: true })] }),
  new Paragraph({ spacing: { before: 800 }, alignment: AlignmentType.CENTER, children: [run("Submitted by:", { size: SZ_BODY })] }),
  new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.CENTER, children: [run("Jeevant Verma (102303100)", { size: SZ_BODY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Aniket Saxena (102303278)", { size: SZ_BODY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Lakshita Gupta (102303505)", { size: SZ_BODY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Mannat Kaur Miglani (102303720)", { size: SZ_BODY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Yuvansh Pathak (102317061)", { size: SZ_BODY })] }),
  new Paragraph({ spacing: { before: 400 }, alignment: AlignmentType.CENTER, children: [run("BE Third Year, CoE/CoSE", { size: SZ_BODY })] }),
  new Paragraph({ spacing: { before: 100 }, alignment: AlignmentType.CENTER, children: [run("CPG No: 311", { size: SZ_BODY })] }),
  new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER, children: [run("Under the Mentorship of", { size: SZ_BODY })] }),
  new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.CENTER, children: [run("Dr. Tarunpreet Bhatia", { size: SZ_BODY, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Associate Professor, CSED", { size: SZ_BODY })] }),
  new Paragraph({ spacing: { before: 1400 }, alignment: AlignmentType.CENTER, children: [run("Computer Science and Engineering Department", { size: SZ_BODY, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Thapar Institute of Engineering and Technology, Patiala", { size: SZ_BODY, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [run("August 2026", { size: SZ_BODY, bold: true })] }),
];

// ---------- FRONT MATTER: SECTION 2 (roman numerals) ----------
const frontMatter = [
  heading("ABSTRACT", HeadingLevel.HEADING_1),
  body(
    "This project was originally motivated by the rise of “digital arrest” and impersonation scams — fraudsters posing as police or government officials over a live video or voice call, using fabricated uniforms, warrants, and sustained real-time psychological pressure to extort victims — a scam pattern that depends entirely on the victim having no way to verify, in the moment, whether the face and voice on the call are genuine. Modern identity fraud more broadly increasingly relies on AI-generated voice clones, deepfake facial impersonation, and digitally forged documents, exploiting the fact that most verification systems evaluate voice, face, and document checks independently rather than as a single fused decision. This project, Real-Time Fraud Detection Smart Glasses, addresses that gap with a wearable system that fuses four verification modalities — voice liveness, facial deepfake detection, document authenticity, and face-to-ID identity matching — into one real-time SAFE / SUSPICIOUS / FRAUD verdict, delivered discreetly to the wearer. The system is scoped around a clear hierarchy of use: live video-call impersonation (e.g. digital-arrest scams) as the primary, flagship scenario in which facial and voice liveness are jointly meaningful; voice-only call fraud as a secondary scenario exercising voice liveness alone; and in-person credential verification — document authenticity and face-to-ID matching — as a further, distinct application of the same fusion engine."
  ),
  body(
    "As of this mid-semester evaluation, the cloud verification engine (all four detection modules plus the multi-modal decision-fusion logic) and the browser-based prototype dashboard are fully built and tested. On the hardware side, the ESP32-S3-based smart glasses firmware has been brought up on real hardware: the voice-anti-spoofing pipeline — on-device audio capture, wireless upload, cloud analysis, and verdict display — has been verified working end-to-end across multiple consecutive live test cycles. Camera integration is in progress; a sensor-compatibility issue was identified and isolated for continued work without affecting the working voice path."
  ),
  body(
    "During this phase, a systematic review of the fusion logic uncovered and corrected two real weaknesses in the original decision-fusion design — a single strongly fraudulent signal could previously be diluted to a false SAFE verdict by unrelated genuine scores, and an unevaluated modality was defaulting to a fully-trusted score rather than being excluded. Both are fixed and verified against a documented set of encounter scenarios. A further finding — that the on-board microphone's frequency response does not suit the hand-tuned voice heuristic calibrated during earlier browser-based testing — has been diagnosed and is documented as a driver for the project's next phase: replacing hand-tuned heuristics with models fine-tuned on established datasets, per guidance received from the project mentor."
  ),
  new Paragraph({ children: [new PageBreak()] }),

  heading("DECLARATION", HeadingLevel.HEADING_1),
  body(
    "We hereby declare that the design principles and working prototype model of the project entitled “Real-Time Fraud Detection Smart Glasses” is an authentic record of our own work carried out in the Computer Science and Engineering Department, TIET, Patiala, under the guidance of Dr. Tarunpreet Bhatia during the 6th semester (2026)."
  ),
  body("Date: ____________________", { align: AlignmentType.LEFT }),
  new Paragraph({ spacing: { before: 600 }, children: [run("Counter Signed By:", { size: SZ_BODY })] }),
  new Paragraph({ spacing: { before: 400 }, children: [run("Faculty Mentor:", { size: SZ_BODY })] }),
  new Paragraph({ spacing: { before: 400 }, children: [run("Dr. Tarunpreet Bhatia", { size: SZ_BODY, bold: true })] }),
  new Paragraph({ children: [run("Associate Professor, CSED", { size: SZ_BODY })] }),
  new Paragraph({ children: [run("CSED, TIET, Patiala", { size: SZ_BODY })] }),
  new Paragraph({ children: [new PageBreak()] }),

  heading("ACKNOWLEDGEMENT", HeadingLevel.HEADING_1),
  body(
    "We would like to express our sincere thanks to our mentor, Dr. Tarunpreet Bhatia, Associate Professor, CSED. She has been of great help throughout this project and an indispensable resource of technical knowledge and guidance."
  ),
  body(
    "We are also thankful to the Head, Computer Science and Engineering Department, the entire faculty and staff of the department, and our friends who devoted their valuable time and helped us in all possible ways towards the successful completion of this project. We thank all those who have contributed either directly or indirectly towards this project."
  ),
  body("Lastly, we would also like to thank our families for their unyielding love and encouragement."),
  body("Date: ____________________"),
  new Paragraph({ children: [new PageBreak()] }),

  heading("TABLE OF CONTENTS", HeadingLevel.HEADING_1),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
  new Paragraph({ children: [new PageBreak()] }),

  heading("LIST OF TABLES", HeadingLevel.HEADING_1),
  body("Table 2.1: Literature Survey Findings"),
  body("Table 2.2: Cost Analysis"),
  body("Table 2.3: Risk Analysis"),
  body("Table 3.1: Work Breakdown Structure"),
  body("Table 4.1: Build Status Legend"),
  body("Table 5.1: Work Accomplished vs. Approved Objectives"),
  new Paragraph({ children: [new PageBreak()] }),

  heading("LIST OF FIGURES", HeadingLevel.HEADING_1),
  body("Figure 4.1: Prototype Pipeline (Built & Tested)"),
  body("Figure 4.2: End-Product Pipeline (Target Architecture)"),
  body("Figure 4.3: Use Case Diagram — Overall System"),
  body("Figure 4.4: Sequence Diagram — Voice Verification Flow (Verified on Hardware)"),
  body("Figure 4.5: State Chart Diagram — Device Operating Lifecycle"),
  body("Figure 4.6: Frontend Dashboard — Multi-Modal Risk Card"),
  body("Figure 4.7: Firmware Serial Monitor — Voice Detection Cycle (Real Hardware)"),
  body("Figure 4.8: Physical Prototype — XIAO ESP32-S3 Sense Smart Glasses Build"),
  new Paragraph({ children: [new PageBreak()] }),

  heading("LIST OF ABBREVIATIONS", HeadingLevel.HEADING_1),
  simpleTable(
    ["Abbreviation", "Full Form"],
    [
      ["API", "Application Programming Interface"],
      ["BLE", "Bluetooth Low Energy"],
      ["CNN", "Convolutional Neural Network"],
      ["EER", "Equal Error Rate"],
      ["ELA", "Error Level Analysis"],
      ["FAR / FRR", "False Acceptance Rate / False Rejection Rate"],
      ["FFT", "Fast Fourier Transform"],
      ["I2S", "Inter-IC Sound (audio bus protocol)"],
      ["JSON", "JavaScript Object Notation"],
      ["KYC", "Know Your Customer"],
      ["PAD", "Presentation Attack Detection"],
      ["PCM", "Pulse Code Modulation"],
      ["PDM", "Pulse Density Modulation"],
      ["PSRAM", "Pseudo-Static Random Access Memory"],
      ["REST", "Representational State Transfer"],
      ["SRS", "Software Requirement Specification"],
      ["TinyML", "Tiny Machine Learning (on-device ML for microcontrollers)"],
      ["WAV", "Waveform Audio File Format"],
      ["WBS", "Work Breakdown Structure"],
    ],
    [3000, 6500]
  ),
];

// ---------- MAIN BODY: SECTION 3 (arabic numerals) ----------
const chapter1 = [
  chapterTitle(1, "Introduction"),

  heading("1.1 Project Overview"),
  body(
    "Real-Time Fraud Detection Smart Glasses is a wearable, cyber-physical system whose primary use-case anchor is protecting individuals against “digital arrest” and impersonation scams conducted over live video or voice calls. Rather than checking a single biometric signal in isolation, as most deployed systems do today, the system continuously fuses four independent verification signals — voice liveness, facial deepfake/presentation-attack detection, document authenticity, and face-to-ID identity matching — into one unified fraud risk score, delivered as a real-time SAFE, SUSPICIOUS, or FRAUD verdict. The document-authenticity and face-to-ID modalities also generalize to in-person credential verification, as noted below; extending that into a dedicated institutional deployment (e.g. for bank tellers, KYC officers, or field-verification personnel) is a potential future direction rather than the project's current focus (Section 5.4)."
  ),
  body(
    "The target architecture follows an Edge – Gateway – Cloud pattern. The Edge layer is a pair of smart glasses built around a Seeed Studio XIAO ESP32-S3 Sense microcontroller, capturing audio and video through an onboard microphone and camera. A paired smartphone acts as the Gateway, relaying data securely to a Cloud backend that performs the actual multi-modal analysis and decision fusion, feeding a result back to the glasses for discreet, bone-conduction-based feedback to the wearer."
  ),
  body(
    "Not every modality is meaningful in every scenario, and the system is scoped accordingly rather than presented as uniformly applicable. A live video call is the primary scenario in which facial liveness and voice liveness are jointly relevant, since both the face and voice the wearer perceives are screen- and speaker-mediated rather than directly observed. A voice-only call exercises voice liveness alone. A genuine in-person encounter, where the wearer directly observes the other party, is a different problem: facial and voice liveness checks add little there, since an unmediated human presence cannot itself be a deepfake or a voice clone, but document authenticity and face-to-ID matching remain fully applicable, since document tampering and stolen-but-genuine credentials are unrelated to AI-generated content. This scoping is treated as a design property of the system, established through this phase's evaluation, rather than a limitation discovered after the fact."
  ),
  body(
    "As detailed in Chapter 4, the project currently exists as two distinct, explicitly tracked pipelines: a fully built and tested prototype pipeline (a browser-based capture interface standing in for the Edge and Gateway layers, feeding the real Cloud verification engine), and the end-product pipeline described above, of which the Cloud engine and the voice-anti-spoofing path on real ESP32-S3 hardware are now working end-to-end. This overview and the remainder of this report describe both what has been verified working and what remains, without conflating the two."
  ),

  heading("1.2 Need Analysis"),
  body(
    "Identity fraud techniques have advanced rapidly alongside generative AI: voice cloning, deepfake facial impersonation, and high-fidelity document forgery are now realistic threats against manual and single-factor verification alike. Regula Forensics reports that 49% of organizations experienced deepfake-based fraud attempts in 2024, up from 29% in 2022, alongside a 244% rise in document forgery attempts [15]. Most deployed verification workflows evaluate voice, face, and document checks independently and after the fact, creating exploitable gaps between modalities and delaying detection until after an interaction has already concluded."
  ),
  body(
    "There is a clear need for a system that performs multi-modal verification in real time, during the interaction itself, without disrupting it — and that does so while minimizing the transmission and storage of raw biometric data, given the privacy obligations verification workflows in banking, KYC, and border-control contexts operate under (e.g. India's DPDP Act, GDPR). This project's wearable, fused, privacy-conscious approach is a direct response to that need."
  ),
  body(
    "Digital-arrest scams are a particularly severe instance of this gap: victims are contacted over a live video or voice call by someone impersonating a police or government official and are placed under sustained psychological pressure before they have any real opportunity to verify who they are actually speaking to. A phone- or laptop-based software solution could, in principle, analyze the same call, but reliably tapping the call stream itself is constrained in practice — no single API works uniformly across the range of calling platforms victims are contacted through, operating-system-level audio/screen capture is typically permission-gated and often surfaces a visible recording indicator, and directly intercepting another party's call audio raises call-recording consent questions in a number of jurisdictions. A wearable that instead observes what is already displayed on the victim's own screen and played through their own speaker — information the victim already has every right to see and hear — avoids that dependency entirely, while requiring no conscious action from a victim who is, by the nature of the scam, already under active psychological pressure."
  ),

  heading("1.3 Research Gaps"),
  body("A review of the current literature (detailed fully in Section 2.1) surfaces the following specific, unaddressed gaps that this project targets:"),
  bullet("No prior work explores microcontroller-class inference for voice anti-spoofing countermeasures — published models (CNN-based CQCC/MFCC through Transformer-based wav2vec/HuBERT architectures) all assume GPU or CPU deployment [1]–[4]."),
  bullet("Matching a live, wearable-camera-captured face against a low-resolution, potentially aged ID photograph at practical wearable capture distances is largely unstudied [5]–[8]."),
  bullet("Published identity-card presentation-attack-detection methods systematically assume stationary, high-resolution cameras; none address the off-angle, variable-distance capture conditions a wearable camera produces [9]–[11]."),
  bullet("No published system integrates simultaneous audio-visual biometric feature extraction on a single microcontroller, despite the hybrid edge-cloud pattern being well established for other resource-constrained deployments [12]–[14]."),
  bullet("All published multi-modal KYC/fraud-detection pipelines identified in the survey are entirely server-side — none combine an edge TinyML component, a wearable form factor, and covert (non-visual, non-audible) result delivery [15]."),

  heading("1.4 Problem Definition and Scope"),
  body(
    "The core problem addressed is the absence of a unified, practical system for reliable, real-time, multi-modal identity verification that avoids the fragmentation of single-factor or independently-evaluated checks. The scope of this project, as approved at the proposal stage, covers: (a) a wearable Edge capture layer, (b) on-device feature extraction, (c) a unified multi-modal Cloud verification and fusion engine, and (d) real-time, discreet result delivery. This report scopes its claims strictly to what has been built and verified as of this evaluation — see Chapter 4 for the explicit built/partial/not-built status of each layer. Within this scope, Section 1.1 establishes which of the four verification modalities are meaningful in which real-world scenario; this report does not claim all four are equally applicable in every deployment context, since a genuine in-person encounter and a screen/speaker-mediated call present fundamentally different threat models."
  ),

  heading("1.5 Assumptions and Constraints"),
  bullet("The wearer has a paired smartphone or equivalent network relay capable of reaching the cloud backend (in the current prototype, direct Wi-Fi connectivity is assumed)."),
  bullet("The subject being verified presents a physical ID document within camera range during the interaction; the system does not query any external identity database."),
  bullet("On-device compute and memory on the ESP32-S3 (8MB PSRAM, 512KB internal SRAM) constrain what feature extraction can be performed at the Edge versus deferred to the Cloud."),
  bullet("Network availability is required for real-time verdicts; the current design does not include an offline fallback mode."),

  heading("1.6 Standards"),
  body(
    "This report follows IEEE citation and reference-list formatting throughout (numeric, bracketed in-text citations resolved against a numbered reference list) [16]. On the technical side, the project's document-forgery and presentation-attack-detection work is scoped against the concepts defined in the ISO/IEC 30107 series (Biometric presentation attack detection). Data interchange between the Edge, Gateway, and Cloud layers uses standard, interoperable formats throughout — JSON over HTTP/REST for all API payloads, and standard PCM/WAV and JPEG encodings for audio and image capture — rather than a proprietary protocol."
  ),

  heading("1.7 Approved Objectives"),
  body("The following objectives were approved at the Proposal Evaluation stage:"),
  bullet("To design a wearable fraud detection system integrated within smart glasses using an Edge-Gateway-Cloud framework, ensuring efficient communication and scalable processing for identity verification tasks."),
  bullet("To implement on-device feature extraction for audio and visual inputs to enable lightweight, privacy-preserving, and responsive data processing."),
  bullet("To develop a unified multi-modal verification system that combines voice, facial, and document-based authentication, reducing the vulnerabilities of single-factor systems."),
  bullet("To enable real-time fraud detection during live interactions by generating immediate risk assessments and relevant analytics."),

  heading("1.8 Methodology"),
  body(
    "The system follows a six-phase pipeline: (1) Data Acquisition at the Edge; (2) On-device Feature Extraction; (3) Wireless Transmission to the Gateway; (4) Multi-Modal Fraud Detection in the Cloud (the four detection modules); (5) Decision Fusion and Risk Scoring; and (6) Result Delivery via bone conduction plus analytics logging. As of this evaluation, Phase 4 and Phase 5 are fully implemented, tested, and hardened against a documented set of edge-case scenarios (Chapter 4). Phase 1 is implemented for audio on real hardware; Phases 2, 3, and the video path of Phase 1 remain in progress. Phase 6's analytics logging is not yet implemented; discreet feedback is currently demonstrated via an LED pattern standing in for the bone-conduction transducer."
  ),

  heading("1.9 Project Outcomes and Deliverables"),
  bullet("A fully built and tested Cloud verification engine exposing four detection endpoints plus a decision-fusion endpoint (Chapter 4)."),
  bullet("A fully built and tested browser-based dashboard exercising all four modalities against the Cloud engine."),
  bullet("ESP32-S3 smart glasses firmware with a verified, working, end-to-end voice-anti-spoofing pipeline on real hardware."),
  bullet("A documented, evidence-based case log validating the fusion engine's behaviour across genuine, fraudulent, and edge-case encounters."),
  bullet("Supporting documentation: system architecture records, a maintained build-status record, and this report."),

  heading("1.10 Novelty of Work"),
  body(
    "The novelty of this work is not in any single detection algorithm — voice anti-spoofing, deepfake detection, and document forgery detection are all established research areas individually. The novelty, consistent with the gaps identified in Section 1.3, is in the combination: fusing all three modalities plus identity matching into one real-time decision, in a wearable form factor, with a design that explicitly avoids persisting any biometric reference data (every verification compares only against material presented in that specific interaction — never a stored personal reference), and targeting eventual on-device feature extraction on a microcontroller rather than requiring a permanently network-attached device."
  ),
];

const chapter2 = [
  chapterTitle(2, "Requirement Analysis"),

  heading("2.1 Literature Survey"),
  heading("2.1.1 Theory Associated with Problem Area", HeadingLevel.HEADING_3),
  body(
    "The problem area spans four technical domains: (a) voice anti-spoofing / audio liveness detection, concerned with distinguishing genuine human speech from synthetic (text-to-speech, voice-conversion) or replayed audio; (b) facial liveness and deepfake detection, concerned with distinguishing a live subject from a screen replay, printed photo, or AI-generated face; (c) document forgery detection, concerned with identifying digital tampering in ID or official documents; and (d) decision fusion, concerned with combining independent, imperfect signals into one reliable verdict."
  ),
  heading("2.1.2 Existing Systems and Solutions", HeadingLevel.HEADING_3),
  body(
    "The ASVspoof challenge series [1]–[3] is the standard benchmark for voice anti-spoofing countermeasures, with published models spanning CNN-based CQCC/MFCC features [4] to Transformer-based wav2vec/HuBERT architectures. FaceNet [5] and ArcFace [6] are the standard embedding models for face verification; FaceForensics++ [8] and the associated survey by Tolosana et al. [7] are the standard reference points for deepfake detection. Document forgery detection is surveyed by Zanardelli et al. [9], with the SIDTD benchmark [10] and the systematic PAD review by Tapia et al. [11] addressing ID-card-specific attacks."
  ),
  heading("2.1.3 Research Findings for Existing Literature", HeadingLevel.HEADING_3),
  body("Table 2.1 summarizes the literature reviewed and its relevance to this project."),
  caption("Table 2.1", "Literature Survey Findings"),
  simpleTable(
    ["S.No", "Team Member", "Paper / Source Title", "Tools / Technology", "Key Finding", "Citation"],
    [
      ["1", "Jeevant Verma", "ASVspoof 2019 / ASVspoof 5", "t-DCF, CM benchmarking", "Standard voice anti-spoofing benchmark; best EER ~6.3%", "[1]–[3]"],
      ["2", "Jeevant Verma", "Battling Voice Spoofing (review)", "CNN, wav2vec, HuBERT", "No microcontroller-class CM inference explored", "[4]"],
      ["3", "Lakshita Gupta", "FaceNet", "128-d embeddings", "99.63% LFW accuracy, mobile-deployable", "[5]"],
      ["4", "Lakshita Gupta", "ArcFace", "Additive angular margin loss", "99.40% LFW, SOTA across 10 benchmarks", "[6]"],
      ["5", "Lakshita Gupta", "DeepFakes and Beyond (survey)", "Face manipulation taxonomy", "Categorizes synthesis/swap/attribute attacks", "[7]"],
      ["6", "Lakshita Gupta", "FaceForensics++", "1,000 manipulated videos", "Domain-specific knowledge improves detection under compression", "[8]"],
      ["7", "Aniket Saxena", "Image Forgery Detection (survey)", "Copy-move/splicing/inpainting CNNs", "Deep learning applicable to document images", "[9]"],
      ["8", "Aniket Saxena", "SIDTD benchmark", "Synthetic ID/travel documents", "Addresses scarcity of real forged-document data", "[10]"],
      ["9", "Aniket Saxena", "ID Card PAD (systematic review)", "50+ PAD methods", "All assume stationary, high-res cameras", "[11]"],
      ["10", "Yuvansh Pathak", "TinyML (Warden & Situnayake)", "TensorFlow Lite Micro", "Establishes on-device inference feasibility", "[12]"],
      ["11", "Yuvansh Pathak", "TinyML on-device inference (survey)", "779 studies surveyed", "Privacy/latency are primary motivations", "[13]"],
      ["12", "Mannat Kaur Miglani", "Emerging Trends in TinyML (review)", "Hybrid edge-cloud pattern", "Pattern established for constrained deployments", "[14]"],
      ["13", "Mannat Kaur Miglani", "Regula Forensics KYC Trends 2025", "Industry statistics", "49% orgs hit by deepfake fraud in 2024", "[15]"],
    ],
    [700, 1700, 2600, 2200, 2900, 1400]
  ),
  heading("2.1.4 Problem Identified", HeadingLevel.HEADING_3),
  body(
    "Across the reviewed literature, verification techniques are consistently developed and evaluated in isolation — a voice countermeasure, a face-matching model, a document PAD method — each assuming stationary, high-resource deployment. No reviewed work combines them into one wearable, real-time, fused decision, which is precisely the gap this project addresses."
  ),
  heading("2.1.5 Survey of Tools and Technologies Used", HeadingLevel.HEADING_3),
  bullet("Backend: Python, FastAPI, OpenCV, DeepFace (Facenet), NumPy/SciPy for signal processing."),
  bullet("Frontend: React 19, Vite, Tailwind CSS, Axios, react-webcam."),
  bullet("Firmware: Arduino-ESP32 core 3.x (ESP-IDF 5.x), Seeed Studio XIAO ESP32-S3 Sense."),
  bullet("Tooling evaluated during this phase: Arduino IDE (adopted) and PlatformIO (evaluated; the actively-maintained pioarduino platform fork was required for ESP-IDF 5.x driver support)."),

  heading("2.2 Software Requirement Specification"),
  heading("2.2.1 Introduction", HeadingLevel.HEADING_3),
  body("2.2.1.1 Purpose", { bold: true }),
  body("This SRS defines the functional and non-functional requirements of the Real-Time Fraud Detection Smart Glasses system as currently implemented and as targeted for the end-product."),
  body("2.2.1.2 Intended Audience and Reading Suggestions", { bold: true }),
  body("This document is intended for the project mentor, evaluation panel, and project team. Readers unfamiliar with the project should read Chapter 1 before this section."),
  body("2.2.1.3 Project Scope", { bold: true }),
  body("See Section 1.4 for the full scope statement."),
  heading("2.2.2 Overall Description", HeadingLevel.HEADING_3),
  body("2.2.2.1 Product Perspective", { bold: true }),
  body(
    "The product is a new, self-contained system rather than an extension of an existing product. It is composed of three cooperating layers (Edge, Gateway, Cloud) as described in Section 1.1, with the Cloud layer independently accessible via a browser-based dashboard for demonstration and testing purposes."
  ),
  body("2.2.2.2 Product Features", { bold: true }),
  bullet("Voice liveness / anti-spoofing detection"),
  bullet("Facial liveness and deepfake detection"),
  bullet("Document authenticity (tamper) detection"),
  bullet("Face-to-ID identity matching"),
  bullet("Multi-modal decision fusion into a single risk verdict"),
  heading("2.2.3 External Interface Requirements", HeadingLevel.HEADING_3),
  body("2.2.3.1 User Interfaces", { bold: true }),
  body("A browser-based dashboard for the Cloud engine (prototype), and an LED-based status indicator on the physical glasses (standing in for the bone-conduction feedback transducer in the current build)."),
  body("2.2.3.2 Hardware Interfaces", { bold: true }),
  body("Seeed Studio XIAO ESP32-S3 Sense (camera, PDM microphone, Wi-Fi 802.11 b/g/n); USB-C for programming and power."),
  body("2.2.3.3 Software Interfaces", { bold: true }),
  body("A RESTful JSON API exposed by the Cloud backend (FastAPI) is the sole interface between the Edge/Gateway layer and the Cloud layer."),
  heading("2.2.4 Other Non-functional Requirements", HeadingLevel.HEADING_3),
  body("2.2.4.1 Performance Requirements", { bold: true }),
  body("Verdicts should be returned within a few seconds of capture to preserve the “real-time” interaction goal; exact latency targets have not yet been formally measured on end-to-end hardware and are noted as future work (Section 5.4)."),
  body("2.2.4.2 Safety Requirements", { bold: true }),
  body("Not applicable in the physical-safety sense; the system does not control any physical actuator beyond a low-power indicator LED / bone-conduction speaker."),
  body("2.2.4.3 Security Requirements", { bold: true }),
  body(
    "No biometric capture (face, voice, or document image) is ever persisted beyond the single request that uses it; every verification compares only against material presented in that specific interaction, never a stored personal reference. This is treated as an inviolable design constraint, not a configurable option."
  ),

  heading("2.3 Cost Analysis"),
  body("Table 2.2 lists the actual, incurred hardware cost of the current physical prototype."),
  caption("Table 2.2", "Cost Analysis"),
  simpleTable(
    ["Component", "Cost (₹)"],
    [
      ["XIAO ESP32-S3 Sense", "1,731.80"],
      ["32GB SD Card", "650.50"],
      ["Breadboard + Jumper Wires", "259.40"],
      ["TP4056 LiPo Charger Module", "120.15"],
      ["3.7V 1000mAh LiPo Battery", "379.70"],
      ["Bone Conduction Earphones (module)", "Not yet purchased — pending"],
      ["TOTAL (incurred to date)", "3,141.55"],
    ],
    [6000, 3500]
  ),
  body(
    "Cloud infrastructure cost is currently zero, as the backend runs on locally-hosted development hardware during prototyping; a hosting cost will need to be budgeted before any deployed pilot."
  ),

  heading("2.4 Risk Analysis"),
  body("Table 2.3 lists risks identified and, where applicable, already observed during this development phase, rather than only hypothetical ones."),
  caption("Table 2.3", "Risk Analysis"),
  simpleTable(
    ["Risk", "Likelihood", "Impact", "Mitigation / Status"],
    [
      ["Hand-tuned detection heuristics fail to generalize across hardware (observed: the onboard PDM microphone's frequency response falls outside what the voice heuristic assumes)", "Confirmed — occurred", "High", "Diagnosed this phase; mitigation is planned migration to fine-tuned pretrained models (Section 5.4)"],
      ["Single point of failure: Cloud backend must be reachable for any verdict", "Medium", "High", "Acceptable for prototype stage; offline fallback out of current scope"],
      ["Camera sensor incompatibility (OV3660 vs. assumed OV2640) blocking hardware bring-up", "Confirmed — occurred", "Medium", "Isolated to a standalone test sketch so it cannot block the working voice path"],
      ["Network environment instability (e.g., captive portals, client-isolated Wi-Fi) preventing Edge–Cloud connectivity", "Confirmed — occurred during testing", "Medium", "Mitigated by using a dedicated mobile hotspot for hardware testing"],
      ["Fusion logic diluting a genuine fraud signal via averaging", "Confirmed — found and fixed", "High", "Escalation-floor logic added and verified against a documented case log"],
    ],
    [3800, 1400, 1200, 3100]
  ),
];

const chapter3 = [
  chapterTitle(3, "Methodology Adopted"),

  heading("3.1 Investigative Techniques"),
  body(
    "This project is primarily an Experimental investigative project: it involves building a working system, running controlled, repeatable test cycles (both simulated case-log scenarios and live hardware trials), and evaluating outcomes against expected behaviour — rather than a purely descriptive or comparative study. A Comparative element is also present in the Requirement Analysis phase (Chapter 2), where the project's approach is positioned against existing single-modality and server-side-only systems from the literature."
  ),
  body(
    "In practice this meant: implementing each detection module, constructing a documented set of encounter scenarios (genuine interactions, single-modality fraud, coordinated multi-modality fraud, and system edge-cases such as missing or corrupted input), running the system against them, and using the results to find and correct real defects in the fusion logic — rather than relying on the design being correct by inspection alone. The same experimental approach was then extended to physical hardware: the firmware was brought up incrementally, with each subsystem (Wi-Fi, PSRAM, microphone, camera) verified independently via on-device diagnostic logging before being relied upon."
  ),

  heading("3.2 Proposed Solution"),
  body(
    "The proposed solution is the six-phase Edge–Gateway–Cloud pipeline introduced in Section 1.8. Concretely: smart glasses built on a XIAO ESP32-S3 Sense capture audio and (once camera bring-up is complete) video; a phone or direct Wi-Fi link relays captured data to a cloud backend; the cloud backend runs four independent detection modules and a weighted decision-fusion function; and the result is returned to the glasses for discreet feedback."
  ),
  body(
    "The decision-fusion function combines the four modality scores with fixed weights (voice liveness 35%, facial liveness 35%, face-to-ID match 15%, document authenticity 15%), renormalized across whichever modalities were actually evaluated for a given interaction. An escalation rule then applies a floor to the fused verdict: any individual modality that fails its own liveness/authenticity threshold prevents the overall verdict from being averaged back down to SAFE, regardless of how strong the other scores are — this was a direct fix arising from the case-log evaluation described in Chapter 4."
  ),

  heading("3.3 Work Breakdown Structure"),
  body("Table 3.1 summarizes the major work packages and their current status."),
  caption("Table 3.1", "Work Breakdown Structure"),
  simpleTable(
    ["Work Package", "Deliverable", "Status"],
    [
      ["Cloud Verification Engine", "4 detection endpoints + fusion endpoint", "Complete, tested"],
      ["Frontend Dashboard", "Browser-based multi-modal demo UI", "Complete, tested"],
      ["Firmware — Voice Module", "On-device capture → Cloud → verdict, on real hardware", "Complete, verified on hardware"],
      ["Firmware — Camera Module", "OV3660-compatible camera bring-up", "In progress"],
      ["Firmware — TinyML Feature Extraction", "On-device audio/visual feature extraction", "Not started"],
      ["Gateway (Phone Relay)", "Secure relay app between glasses and cloud", "Not started"],
      ["Bone Conduction Feedback", "Physical discreet-alert transducer", "Not started (LED stand-in in use)"],
      ["Analytics & Logging", "Persisted session/verdict analytics", "Not started"],
      ["Model Fine-Tuning", "Replace heuristic detectors with fine-tuned pretrained models", "Planned next phase"],
    ],
    [2800, 3800, 2900]
  ),

  heading("3.4 Tools and Technology"),
  bullet("Backend: Python 3, FastAPI, Uvicorn, OpenCV, DeepFace, NumPy, SciPy, SoundFile, Pillow."),
  bullet("Frontend: React 19, Vite, Tailwind CSS, Axios, react-webcam."),
  bullet("Firmware: C/C++ (Arduino framework), Arduino-ESP32 core 3.x on ESP-IDF 5.x, esp32-camera, I2S PDM driver."),
  bullet("Hardware: Seeed Studio XIAO ESP32-S3 Sense, breadboard prototyping, LiPo power supply with TP4056 charge management."),
  bullet("Version control and collaboration: Git / GitHub."),
];

const chapter4 = [
  chapterTitle(4, "Design Specifications"),

  heading("4.1 System Architecture"),
  body(
    "The system is deliberately tracked as two distinct pipelines — the currently built and tested prototype pipeline, and the end-product pipeline described in the original proposal — so that build status is never overstated. Table 4.1 gives the legend used consistently across both."
  ),
  caption("Table 4.1", "Build Status Legend"),
  simpleTable(
    ["Status", "Meaning"],
    [
      ["Built & Tested", "Cloud verification engine (all 4 detection endpoints + fusion), frontend dashboard, ESP32-S3 voice pipeline"],
      ["Partially Built", "ESP32-S3 microphone driver and Wi-Fi stack (camera driver present but not yet functional)"],
      ["Not Yet Built", "TinyML on-device feature extraction, phone gateway relay, bone-conduction feedback hardware, persisted analytics"],
    ],
    [2800, 6500]
  ),
  body("Figure 4.1 (prototype pipeline) and Figure 4.2 (end-product pipeline) are inserted below as placeholders for the architecture diagrams maintained in the project repository."),
  placeholderFigure("Figure 4.1", "Prototype Pipeline — Browser capture → Cloud verification engine → Frontend risk card"),
  caption("Figure 4.1", "Prototype Pipeline (Built & Tested)"),
  placeholderFigure("Figure 4.2", "End-Product Pipeline — ESP32-S3 Edge → Phone Gateway → Cloud → Bone Conduction Feedback + Analytics"),
  caption("Figure 4.2", "End-Product Pipeline (Target Architecture)"),
  body(
    "As Figure 4.2 indicates, the Cloud verification engine at the centre of the end-product pipeline is the same engine already built and tested in the prototype (Figure 4.1) — it does not need to be rebuilt as the surrounding Edge and Gateway layers are completed; only the transport into and out of it changes."
  ),

  heading("4.2 Design Level Diagrams"),
  body(
    "This section presents the UML views used to design the system: a Use Case diagram for the overall system, a Sequence diagram for the single most significant case — the voice-verification flow, since it is the one path verified working end-to-end on real hardware — and a State Chart diagram for the device's operating lifecycle. Each is discussed in detail below and referenced by figure number in the surrounding text, per the reporting guidelines."
  ),
  body(
    "Figure 4.3 is the system-level Use Case diagram. Two actors interact with the system: the Verification Officer, who wears the glasses and initiates capture and views the resulting verdict, and the Subject, the person being verified, who is the source of the voice, face, and document material captured. Each capture use case feeds its corresponding check use case directly — reflecting the fresh-analysis design principle (Section 2.2.4.3): a check always consumes the material captured in that specific interaction, never a stored reference. The four check use cases are drawn into the Fuse Multi-Modal Risk Score use case via an «include» relationship, since fusion cannot occur without at least one completed check, matching the fusion engine's actual behaviour of excluding rather than assuming any modality that was not evaluated."
  ),
  image("diagrams/uc_diagram.png", 550, 373),
  caption("Figure 4.3", "Use Case Diagram — Overall System"),
  body(
    "Figure 4.4 is a Sequence diagram for the voice-verification case specifically, because it is the one case confirmed working end-to-end on physical hardware this phase, rather than a hypothetical flow. Five participants are shown: the Wearer, the ESP32-S3 firmware, the Cloud's /voice-check endpoint, the Cloud's /risk-score endpoint, and the onboard LED used as the current stand-in for the bone-conduction transducer. The dashed return arrows distinguish response messages from request messages, consistent with standard UML sequence notation. This exact message order — record, upload, receive a liveness score, forward that score for fusion, receive a verdict, and display it — was confirmed by reading the firmware's own Serial debug output across multiple consecutive live cycles, not assumed from the design alone."
  ),
  image("diagrams/seq_diagram.png", 550, 333),
  caption("Figure 4.4", "Sequence Diagram — Voice Verification Flow (Verified on Hardware)"),
  body(
    "Figure 4.5 is a State Chart diagram for the device's overall operating lifecycle, covering both the one-time boot sequence (Boot, Connecting Wi-Fi, Initializing Microphone) and the repeating detection cycle (Capturing Audio, Uploading to Cloud, Displaying Verdict), which repeats every 10 seconds. An Error state is reachable from either boot step on a timeout or initialization failure, matching the firmware's actual halt-and-blink behaviour on those failures — the device does not silently continue in an undefined state. This diagram intentionally omits the camera-related states, since camera initialization is currently skipped in the firmware's boot sequence (Section 5.1) precisely so that a camera fault cannot block this lifecycle."
  ),
  image("diagrams/state_diagram.png", 500, 324),
  caption("Figure 4.5", "State Chart Diagram — Device Operating Lifecycle"),

  heading("4.3 User Interface Diagrams"),
  body("The frontend dashboard (Figure 4.6) presents one card per detection modality plus a unified fusion card, so that both the individual module outputs and the fused verdict are visible simultaneously during a demonstration or test."),
  placeholderFigure("Figure 4.6", "Frontend Dashboard — Multi-Modal Risk Card"),
  caption("Figure 4.6", "Frontend Dashboard — Multi-Modal Risk Card"),

  heading("4.4 Snapshots of Working Prototype"),
  body(
    "This section walks through the verified, working voice-detection cycle on real hardware, step by step, corresponding to the figures inserted below (to be populated with the team's captured screenshots)."
  ),
  bullet("Step 1: The XIAO ESP32-S3 Sense boots, connects to Wi-Fi, and initializes its onboard PDM microphone (Figure 4.7)."),
  bullet("Step 2: On each detection cycle, the device records 5 seconds of 16 kHz mono PCM audio into PSRAM."),
  bullet("Step 3: The captured audio is packaged as a WAV file and uploaded over HTTP to the Cloud backend's /voice-check endpoint."),
  bullet("Step 4: The backend's voice-liveness module analyses the audio and returns a liveness score and spoof classification."),
  bullet("Step 5: The score is forwarded to the /risk-score fusion endpoint, which returns a unified verdict."),
  bullet("Step 6: The verdict is displayed via the onboard LED (standing in for the bone-conduction transducer) and logged over Serial for verification."),
  placeholderFigure("Figure 4.7", "Firmware Serial Monitor — Voice Detection Cycle (Real Hardware)"),
  caption("Figure 4.7", "Firmware Serial Monitor — Voice Detection Cycle (Real Hardware)"),
  placeholderFigure("Figure 4.8", "Physical Prototype — XIAO ESP32-S3 Sense Smart Glasses Build"),
  caption("Figure 4.8", "Physical Prototype — XIAO ESP32-S3 Sense Smart Glasses Build"),
  body(
    "This cycle was confirmed working across multiple consecutive runs, not a single successful attempt — the backend request log for the test session shows repeated, consecutive successful voice-check → risk-score pairs, which was treated as the bar for calling this module verified rather than a one-off result."
  ),
];

const chapter5 = [
  chapterTitle(5, "Conclusions and Future Scope"),

  heading("5.1 Work Accomplished"),
  body("Table 5.1 maps current progress directly against the four objectives approved at the Proposal Evaluation stage (Section 1.7)."),
  caption("Table 5.1", "Work Accomplished vs. Approved Objectives"),
  simpleTable(
    ["Approved Objective", "Status"],
    [
      ["1. Wearable system using Edge-Gateway-Cloud framework", "Cloud layer complete; Edge (voice) verified on hardware; Gateway not yet built"],
      ["2. On-device feature extraction for audio/visual inputs", "Not yet started — current firmware uploads raw captured audio, not extracted features"],
      ["3. Unified multi-modal verification (voice, facial, document)", "Complete and tested in the Cloud engine; verified on hardware for voice specifically"],
      ["4. Real-time fraud detection with immediate risk assessment", "Complete for the implemented modalities; analytics logging not yet implemented"],
    ],
    [5800, 3500]
  ),

  heading("5.2 Conclusions"),
  body(
    "At this evaluation stage, the project has established a working, tested Cloud decision-fusion engine and demonstrated the full Edge-to-Cloud loop on real hardware for one modality (voice), which was set as the concrete milestone for this phase. This was not an arbitrary choice of module: voice liveness is the one check common to both the primary (video-call) and secondary (voice-only-call) digital-arrest scenarios described in Section 1.1, making it the correct first modality to prove end-to-end. Equally significant is what this phase's testing surfaced: two real defects in the original fusion design were found and corrected using an evidence-based case log rather than being assumed correct, and a hardware/heuristic mismatch was diagnosed with root-cause evidence rather than left as an unexplained failure. These findings directly motivate the project's next phase and demonstrate the value of testing against real hardware and adversarial scenarios early, rather than only against the happy path."
  ),

  heading("5.3 Environmental / Economic / Social Benefits"),
  bullet("Social: gives individuals a real-time way to check whether the person on a live call is genuine, directly addressing digital-arrest and impersonation scams that currently rely entirely on victims having no way to verify this in the moment; the same underlying checks also reduce reliance on manual, error-prone identity verification in institutional contexts (banking, KYC, border control) as a potential future direction."),
  bullet("Economic: a low-cost hardware bill of materials (₹3,141.55 to date, excluding the bone-conduction module) relative to dedicated commercial biometric verification hardware."),
  bullet("Privacy: the system's fresh-analysis design principle — never persisting a biometric reference beyond the single interaction that uses it — directly supports compliance with data-minimization principles in regulations such as India's DPDP Act and the EU's GDPR."),

  heading("5.4 Future Work Plan"),
  bullet("Complete camera bring-up on the OV3660 sensor variant, isolated in a standalone test sketch to avoid risking the working voice pipeline."),
  bullet("Implement on-device TinyML feature extraction (Objective 2), starting with audio (MFCC-style features) before video."),
  bullet("Replace the current hand-tuned detection heuristics with models fine-tuned on established public datasets (ASVspoof, FaceForensics++, SIDTD), per guidance received from the project mentor that fine-tuning pretrained models is an acceptable and preferable approach to training from scratch."),
  bullet("Build the phone Gateway relay application and the bone-conduction feedback hardware."),
  bullet("Formally measure end-to-end latency on hardware and establish a performance requirement baseline (Section 2.2.4.1)."),
  bullet("Implement persisted analytics and session logging (Objective 4)."),
  bullet("Explore a dedicated institutional deployment of the document-authenticity and face-to-ID matching modalities — e.g. for bank tellers, KYC officers, or field-verification personnel — as a distinct future application beyond the project's current digital-arrest-scam focus."),
  bullet("Since the Cloud verification engine is decoupled from the ESP32-specific firmware — every detection endpoint is a plain HTTP API accepting an image or audio file, not a protocol tied to this board — investigate portability of the same backend to commercial AR/smart-glasses platforms as and when they expose developer access to their camera/microphone pipeline; no such open access is currently available on, for example, Meta's Ray-Ban smart glasses, so this remains a stated direction rather than a tested integration."),
];

const appendixA = [
  chapterTitle("A", "References"),
  ref(1, "M. Todisco, X. Wang, V. Vestman, M. Sahidullah, H. Delgado, A. Nautsch, J. Yamagishi, N. Evans, T. H. Kinnunen, and K. A. Lee, “ASVspoof 2019: Future horizons in spoofed and fake audio detection,” in Proc. Interspeech 2019, 2019, pp. 1008–1012."),
  ref(2, "X. Wang, J. Yamagishi, M. Todisco, H. Delgado, A. Nautsch, N. Evans, M. Sahidullah, V. Vestman, T. H. Kinnunen, and K. A. Lee, “ASVspoof 2019: A large-scale public database of synthesized, converted and replayed speech,” Computer Speech & Language, vol. 64, p. 101114, 2020."),
  ref(3, "X. Wang et al., “ASVspoof 5: Crowdsourced speech data, deepfake attacks, and adversarial countermeasures,” in Proc. Interspeech 2024, 2024. [Online]. Available: arXiv:2408.08739"),
  ref(4, "A. Khan et al., “Battling voice spoofing: A review and generalizability evaluation of voice anti-spoofing methods,” 2023. [Online]. Available: arXiv:2306.11214"),
  ref(5, "F. Schroff, D. Kalenichenko, and J. Philbin, “FaceNet: A unified embedding for face recognition and clustering,” in Proc. IEEE/CVF CVPR, 2015, pp. 815–823."),
  ref(6, "J. Deng, J. Guo, N. Xue, and S. Zafeiriou, “ArcFace: Additive angular margin loss for deep face recognition,” in Proc. IEEE/CVF CVPR, 2019, pp. 4690–4699."),
  ref(7, "R. Tolosana, R. Vera-Rodriguez, J. Fierrez, A. Morales, and J. Ortega-Garcia, “DeepFakes and beyond: A survey of face manipulation and fake detection,” Information Fusion, vol. 64, pp. 131–148, 2020."),
  ref(8, "A. Rössler, D. Cozzolino, L. Verdoliva, C. Riess, J. Thies, and M. Nießner, “FaceForensics++: Learning to detect manipulated facial images,” in Proc. IEEE/CVF ICCV, 2019, pp. 1–11."),
  ref(9, "M. Zanardelli, F. Guerrini, R. Leonardi, and N. Adami, “Image forgery detection: A survey of recent deep-learning approaches,” Multimedia Tools and Applications, vol. 82, pp. 17521–17566, 2023."),
  ref(10, "C. Boned, M. Talarmain, N. Ghanmi, et al., “Synthetic dataset of ID and travel documents,” Scientific Data, vol. 11, p. 1356, 2024."),
  ref(11, "J. E. Tapia et al., “Identity card presentation attack detection: A systematic review,” 2025. [Online]. Available: arXiv:2511.06056"),
  ref(12, "P. Warden and D. Situnayake, TinyML: Machine Learning with TensorFlow Lite on Arduino and Ultra-Low-Power Microcontrollers. Sebastopol, CA: O'Reilly Media, 2020."),
  ref(13, "L. Capogrosso et al., “TinyML and on-device inference: A survey of applications,” Electronics, vol. 14, no. 8, 2025."),
  ref(14, "J. D. Velasquez-Henao et al., “Emerging trends in TinyML: A review,” Neurocomputing, vol. 629, p. 129418, 2025."),
  ref(15, "Regula Forensics, “KYC trends 2025: Deepfake and document forgery statistics,” Regula Forensics, 2024."),
  ref(16, "IEEE, “IEEE Referencing Style Sheet,” based on IEEE Citation Reference guide. [Online]. Available: https://www.ieee.org/documents/ieeecitationref.pdf"),
];

const appendixB = [
  chapterTitle("B", "Plagiarism Report"),
  body("[Plagiarism similarity report to be generated via the institute's designated plagiarism-detection tool and inserted here prior to final submission.]", { italics: true }),
];

// ---------- numbering config for bullets ----------
const numbering = {
  config: [
    {
      reference: "bullet-list",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
    },
  ],
};

// ---------- footers ----------
const footerRoman = new Footer({
  children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SZ_TABLE })],
    }),
  ],
});
const footerArabic = footerRoman;

const doc = new Document({
  creator: "Real-Time Fraud Detection Smart Glasses Team",
  title: "Real-Time Fraud Detection Smart Glasses — Mid Semester Evaluation Report",
  numbering,
  styles: {
    default: {
      document: { run: { font: FONT, size: SZ_BODY }, paragraph: { spacing: { line: LINE_1_5, lineRule: "auto" } } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: SZ_CHAPTER, bold: true },
        paragraph: { spacing: { line: LINE_1_5, lineRule: "auto", before: 200, after: 300 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: SZ_HEADING, bold: true },
        paragraph: { spacing: { line: LINE_1_5, lineRule: "auto", before: 240, after: 160 }, outlineLevel: 1 },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: SZ_HEADING, bold: true },
        paragraph: { spacing: { line: LINE_1_5, lineRule: "auto", before: 200, after: 140 }, outlineLevel: 2 },
      },
    ],
  },
  sections: [
    {
      properties: { page: { size: A4, margin: MARGIN } },
      children: titlePageChildren,
    },
    {
      properties: {
        page: { size: A4, margin: MARGIN, pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } },
      },
      footers: { default: footerRoman },
      children: frontMatter,
    },
    {
      properties: {
        page: { size: A4, margin: MARGIN, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      footers: { default: footerArabic },
      children: [...chapter1, ...chapter2, ...chapter3, ...chapter4, ...chapter5, ...appendixA, ...appendixB],
    },
  ],
});

const { Packer } = require("docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(nodePath.join(__dirname, "..", "Fraud_Detection_Smart_Glasses_Mid_Sem_Report.docx"), buf);
  console.log("written");
});
