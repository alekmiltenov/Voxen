import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home        from "./pages/Home";
import Communicate from "./pages/Communicate";
import Actions     from "./pages/Actions";
import Keyboard    from "./pages/Keyboard";
<<<<<<< Updated upstream
import AIChat      from "./pages/AIChat";
import Settings    from "./pages/Settings";
import Login       from "./pages/Login";
import Signup      from "./pages/Signup";
import Pain        from "./pages/Pain";

=======
import CaretakerDashboard from "./pages/caretaker/CaretakerDashboard";
import { HeadControlProvider } from "./pages/HeadControlContext";
import TestSocket from "./pages/TestControl";
import Settings from "./pages/Settings";
>>>>>>> Stashed changes
function App() {
  return (
     <HeadControlProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/"            element={<Home />} />
        <Route path="/communicate" element={<Communicate />} />
        <Route path="/actions"     element={<Actions />} />
        <Route path="/keyboard"    element={<Keyboard />} />
<<<<<<< Updated upstream
        <Route path="/ai-chat"     element={<AIChat />} />
        <Route path="/settings"    element={<Settings />} />
        <Route path="/login"       element={<Login />} />
        <Route path="/signup"      element={<Signup />} />
        <Route path="/pain"        element={<Pain />} />
=======
        <Route path="/caretaker"   element={<CaretakerDashboard />} />
        <Route path="/test" element={<TestSocket />}  />
        <Route path="/settings" element={<Settings />} />
>>>>>>> Stashed changes
      </Routes>
    </BrowserRouter>
    </HeadControlProvider>
  );
}

export default App;
