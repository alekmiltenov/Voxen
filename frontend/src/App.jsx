import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home        from "./pages/Home";
import Communicate from "./pages/Communicate";
import Actions     from "./pages/Actions";
import Keyboard    from "./pages/Keyboard";
import AIChat      from "./pages/AIChat";
import EyeTracking from "./pages/EyeTracking";

import TestSocket from "./pages/TestControl";
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"            element={<Home />} />
        <Route path="/communicate" element={<Communicate />} />
        <Route path="/actions"     element={<Actions />} />
        <Route path="/keyboard"    element={<Keyboard />} />
        <Route path="/ai-chat"     element={<AIChat />} />
        <Route path="/eye"         element={<EyeTracking />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
