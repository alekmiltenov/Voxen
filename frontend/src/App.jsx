import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home        from "./pages/Home";
import Communicate from "./pages/Communicate";
import Actions     from "./pages/Actions";
import Keyboard    from "./pages/Keyboard";
import CaretakerDashboard from "./pages/caretaker/CaretakerDashboard";
import Pain from "./pages/Pain";

import TestSocket from "./pages/TestControl";
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"            element={<Home />} />
        <Route path="/communicate" element={<Communicate />} />
        <Route path="/actions"     element={<Actions />} />
        <Route path="/keyboard"    element={<Keyboard />} />
        <Route path="/caretaker"   element={<CaretakerDashboard />} />
        <Route path="/test" element={<TestSocket />}  />
        <Route path="/pain" element={<Pain />}  />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
