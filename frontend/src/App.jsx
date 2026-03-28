import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home        from "./pages/Home";
import Communicate from "./pages/Communicate";
import Actions     from "./pages/Actions";
import Keyboard    from "./pages/Keyboard";
import CaretakerDashboard from "./pages/caretaker/CaretakerDashboard";
import { InputControlProvider } from "./pages/InputControlContext";
import Settings from "./pages/Settings";
function App() {
  return (
     <InputControlProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/"            element={<Home />} />
        <Route path="/communicate" element={<Communicate />} />
        <Route path="/actions"     element={<Actions />} />
        <Route path="/keyboard"    element={<Keyboard />} />
        <Route path="/caretaker"   element={<CaretakerDashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
    </InputControlProvider>
  );
}

export default App;
