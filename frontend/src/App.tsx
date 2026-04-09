import { Route, Routes, BrowserRouter } from "react-router-dom";
import "./css/App.css";
import Home from "./pages/Home";
import { AuthProvider } from "./component/AuthProvider";
import NavBar from "./component/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import MyAccount from "./pages/MyAccount";
import UserRoute from "./component/UserRoute";
import Forget from "./pages/ForgetPassword";
import Square from "./pages/CreativeSquare";
import PostDetailPage from "./pages/PostDetail";
import ProductCustomization from "./pages/ProductCustomization";
import PoolCueCustomization from "./pages/PoolCueCustomization";
import Live2DViewer from "./component/Live2DViewer";
import { useAuth } from "./hooks/useAuth";
import About from "./pages/About";

// 创建一个内部组件，以便能够使用 useAuth Hook
const AppContent = () => {
  // 从 AuthContext 中获取用户状态
  // 注意：这里的 user 变量名取决于你 AuthProvider 里的定义
  const { auth } = useAuth(); 

  return (
    <BrowserRouter>
      <div className="nav-block">
        <NavBar />
      </div>
      
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forget_password" element={<Forget />} />
        <Route
          path="/CreativeSquare"
          element={
            <UserRoute>
              <Square />
            </UserRoute>
          }
        />
        <Route
          path="/posts/:postId"
          element={
            <UserRoute>
              <PostDetailPage />
            </UserRoute>
          }
        />
        <Route
          path="/product-customization"
          element={
            <UserRoute>
              <ProductCustomization />
            </UserRoute>
          }
        />
        <Route
          path="/product-customization/pool-cue"
          element={
            <UserRoute>
              <PoolCueCustomization />
            </UserRoute>
          }
        />
        <Route
          path="/my_account"
          element={
            <UserRoute>
              <MyAccount />
            </UserRoute>
          }
        />
        <Route
          path="/users/:userId"
          element={
            <UserRoute>
              <MyAccount />
            </UserRoute>
          }
        />
        <Route path="/about" element={<About />} />
      </Routes>

      {/* 只有当 user 存在时才渲染 Live2DViewer */}
      {auth.isLoggedIn && <Live2DViewer />}
    </BrowserRouter>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
