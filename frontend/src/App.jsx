import { useRef, useState } from "react";
import Navbar from "./components/Navbar.jsx";
import LiveFeedCard from "./components/LiveFeedCard.jsx";
import FaceVerificationCard from "./components/FaceVerificationCard.jsx";
import VoiceVerificationCard from "./components/VoiceVerificationCard.jsx";
import DocumentVerificationCard from "./components/DocumentVerificationCard.jsx";
import RiskAnalysisCard from "./components/RiskAnalysisCard.jsx";

const dataUrlToFile = (dataUrl, filename) => {
  const [metadata, encoded] = dataUrl.split(",");
  const mime = metadata.match(/:(.*?);/)[1];
  const binary = atob(encoded);
  const array = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }

  return new File([array], filename, { type: mime });
};

const App = () => {
  const webcamRef = useRef(null);
  const [lastCapture, setLastCapture] = useState(null);
  const [liveFaceFile, setLiveFaceFile] = useState(null);

  // Score states
  const [faceLivenessScore, setFaceLivenessScore] = useState(null);
  const [voiceLivenessScore, setVoiceLivenessScore] = useState(null);
  const [docAuthenticityScore, setDocAuthenticityScore] = useState(null);
  const [faceIdMatchScore, setFaceIdMatchScore] = useState(null);

  const captureFace = () => {
    const screenshot = webcamRef.current?.getScreenshot();
    if (!screenshot) {
      return null;
    }

    const file = dataUrlToFile(screenshot, `face-${Date.now()}.jpg`);
    setLastCapture(new Date());
    setLiveFaceFile(file);
    return file;
  };

  const handleDocScores = ({ docAuthenticityScore, faceIdMatchScore }) => {
    setDocAuthenticityScore(docAuthenticityScore);
    setFaceIdMatchScore(faceIdMatchScore);
  };

  return (
    <div className="relative min-h-screen text-white bg-slate-950 font-sans selection:bg-cyan-500 selection:text-black">
      {/* Background Cyber Orbs */}
      <div className="gradient-orb absolute -top-32 right-10 h-96 w-96 opacity-40 blur-3xl" />
      <div className="gradient-orb absolute bottom-12 left-0 h-96 w-96 opacity-30 blur-3xl" />

      <main className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-8">
        <Navbar />

        <section className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Live Wearable Stream & HUD Feed */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <LiveFeedCard webcamRef={webcamRef} lastCapture={lastCapture} />
            <DocumentVerificationCard
              liveFaceFile={liveFaceFile}
              onScore={handleDocScores}
            />
          </div>

          {/* Right Column: AI Anti-Spoofing Analytics & Decision Fusion */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <FaceVerificationCard
              onCapture={captureFace}
              onScore={setFaceLivenessScore}
            />
            <VoiceVerificationCard
              onScore={setVoiceLivenessScore}
            />
            <RiskAnalysisCard
              faceLivenessScore={faceLivenessScore}
              voiceLivenessScore={voiceLivenessScore}
              docAuthenticityScore={docAuthenticityScore}
              faceIdMatchScore={faceIdMatchScore}
            />
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;