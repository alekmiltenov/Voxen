import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home        from "./pages/Home";
import Communicate from "./pages/Communicate";
import Compose     from "./pages/Compose";
import Actions     from "./pages/Actions";
import Keyboard    from "./pages/Keyboard";
import AIChat      from "./pages/AIChat";
import Pain        from "./pages/Pain";
import FoodAndWater   from "./pages/FoodAndWater";
import CaretakerDashboard from "./pages/caretaker/CaretakerDashboard";
import { InputControlProvider, useInputControl } from "./pages/InputControlContextV2";
import Settings from "./pages/Settings";
import EyeTrackingDebug from "./components/EyeTrackingDebug";
import RecenterOverlay from "./components/RecenterOverlay";

function AppContent() {
  const { mode, showRecenterOverlay, showEyeCenterOverlay } = useInputControl();
  const shouldShowOverlay = showRecenterOverlay || (mode === "eyes" && showEyeCenterOverlay);

  return (
    <>
      <Routes>
        <Route path="/"            element={<Home />} />
        <Route path="/communicate" element={<Communicate />} />
        <Route path="/compose"     element={<Compose />} />
        <Route path="/actions"     element={<Actions />} />
        <Route path="/pain"        element={<Pain />} />
        <Route path="/food-and-water"  element={<FoodAndWater />} />
        <Route path="/keyboard"    element={<Keyboard />} />
        <Route path="/ai-chat"     element={<AIChat />} />
        <Route path="/caretaker"   element={<CaretakerDashboard />} />
        <Route path="/settings"    element={<Settings />} />
      </Routes>
      <EyeTrackingDebug />
      {shouldShowOverlay && <RecenterOverlay />}
    </>
  );
}

function App() {
  return (
    <InputControlProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </InputControlProvider>
  );
}

export default App;
