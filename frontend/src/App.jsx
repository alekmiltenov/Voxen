import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Communicate from "./pages/Communicate";
import Actions from "./pages/Actions";



function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/communicate" element={<Communicate />} />
        <Route path="/actions" element={<Actions />} />
        
      </Routes>
    </BrowserRouter>
  );
}

export default App;