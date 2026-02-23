import { Route, Routes, BrowserRouter } from "react-router-dom";
import "./css/App.css";
import Home from "./pages/Home";
import { AuthProvider } from "./component/AuthProvider";
import NavBar from "./component/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import MyAccount from "./pages/MyAccount";
import UserRoute from "./component/UserRoute";

function App() {
  return (
    <>
      <AuthProvider>
        <BrowserRouter>
          <div className="nav-block">
            <NavBar />
          </div>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/my_account"
              element={
                <UserRoute>
                  <MyAccount />
                </UserRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </>
  );
}

export default App;
