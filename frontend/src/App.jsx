import { BrowserRouter, Routes, Route } from "react-router-dom";
<<<<<<< Updated upstream
import Home from "./pages/Home";
import Communicate from "./pages/Communicate";
import Actions from "./pages/Actions";


=======
import Home        from "./pages/Home";
import Communicate from "./pages/Communicate";
import Actions     from "./pages/Actions";
import Keyboard    from "./pages/Keyboard";
>>>>>>> Stashed changes

function App() {
  return (
    <BrowserRouter>
      <Routes>
<<<<<<< Updated upstream
        <Route path="/" element={<Home />} />
        <Route path="/communicate" element={<Communicate />} />
        <Route path="/actions" element={<Actions />} />
        
=======
        <Route path="/"            element={<Home />} />
        <Route path="/communicate" element={<Communicate />} />
        <Route path="/actions"     element={<Actions />} />
        <Route path="/keyboard"    element={<Keyboard />} />
>>>>>>> Stashed changes
      </Routes>
    </BrowserRouter>
  );
}

export default App;
