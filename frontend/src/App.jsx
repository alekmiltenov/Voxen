import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home        from "./pages/Home";
import Communicate from "./pages/Communicate";
import Actions     from "./pages/Actions";
import Keyboard    from "./pages/Keyboard";
import AIChat      from "./pages/AIChat";
import Pain        from "./pages/Pain";
import CaretakerDashboard from "./pages/caretaker/CaretakerDashboard";
import { InputControlProvider } from "./pages/InputControlContext";
import Settings from "./pages/Settings";
import EyeTrackingDebug from "./components/EyeTrackingDebug";

function App() {
  return (
    <InputControlProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"            element={<Home />} />
          <Route path="/communicate" element={<Communicate />} />
          <Route path="/actions"     element={<Actions />} />
          <Route path="/pain"        element={<Pain />} />
          <Route path="/keyboard"    element={<Keyboard />} />
          <Route path="/ai-chat"     element={<AIChat />} />
          <Route path="/caretaker"   element={<CaretakerDashboard />} />
          <Route path="/settings"    element={<Settings />} />
        </Routes>
        <EyeTrackingDebug />
      </BrowserRouter>
    </InputControlProvider>
  );
}

export default App;
