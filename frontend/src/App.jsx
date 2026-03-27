import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home        from "./pages/Home";
import Communicate from "./pages/Communicate";
import Actions     from "./pages/Actions";
import Keyboard    from "./pages/Keyboard";
import AIChat      from "./pages/AIChat";
import Settings    from "./pages/Settings";
import Login       from "./pages/Login";
import Signup      from "./pages/Signup";
import Pain        from "./pages/Pain";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"            element={<Home />} />
        <Route path="/communicate" element={<Communicate />} />
        <Route path="/actions"     element={<Actions />} />
        <Route path="/keyboard"    element={<Keyboard />} />
        <Route path="/ai-chat"     element={<AIChat />} />
        <Route path="/settings"    element={<Settings />} />
        <Route path="/login"       element={<Login />} />
        <Route path="/signup"      element={<Signup />} />
        <Route path="/pain"        element={<Pain />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
