import "./css/App.css";
import { Route, Routes, BrowserRouter } from "react-router-dom";
import Home from "./Home";
import NavBar from "./NavBar";
import About from "./About";
import Detail from "./Detail";
import Contact from "./Contact";

function App() {
  return (
    <>
      <BrowserRouter>
        <div>
          <NavBar />
        </div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/detail/:id" element={<Detail />} />
          <Route path="/about/contact" element={<Contact />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
