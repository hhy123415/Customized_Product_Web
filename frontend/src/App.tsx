import { Route, Routes, BrowserRouter } from "react-router-dom";
import "./css/App.css";
import Home from "./pages/Home";
import { AuthProvider } from "./component/AuthProvider";
import NavBar from "./component/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import MyAccount from "./pages/MyAccount";
import UserRoute from "./component/UserRoute";
import AdminRoute from "./component/AdminRoute";
import Forget from "./pages/ForgetPassword";
import Square from "./pages/CreativeSquare";
import PostDetailPage from "./pages/PostDetail";
import ProductCustomization from "./pages/ProductCustomization";
import PoolCueCustomization from "./pages/PoolCueCustomization";
import CarbonPaddleCustomization from "./pages/CarbonPaddleCustomization";
import Live2DViewer from "./component/Live2DViewer";
import { useAuth } from "./hooks/useAuth";
import About from "./pages/About";
import CreatePostPage from "./pages/CreatePost";
import AdminUserQueryPage from "./pages/AdminUserQuery";
import AdminOrderQueryPage from "./pages/AdminOrderQuery";
import UserOrderQueryPage from "./pages/UserOrderQuery";
import RewardShop from "./pages/RewardShop";
import PointsHistory from "./pages/PointsHistory";

const AppContent = () => {
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
          path="/admin/user-query"
          element={
            <UserRoute>
              <AdminRoute>
                <AdminUserQueryPage />
              </AdminRoute>
            </UserRoute>
          }
        />
        <Route
          path="/admin/order-query"
          element={
            <UserRoute>
              <AdminRoute>
                <AdminOrderQueryPage />
              </AdminRoute>
            </UserRoute>
          }
        />
        <Route
          path="/my-orders"
          element={
            <UserRoute>
              <UserOrderQueryPage />
            </UserRoute>
          }
        />
        <Route
          path="/CreativeSquare"
          element={
            <UserRoute>
              <Square />
            </UserRoute>
          }
        />
        <Route
          path="/posts/create"
          element={
            <UserRoute>
              <CreatePostPage />
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
          path="/product-customization/carbon-paddle"
          element={
            <UserRoute>
              <CarbonPaddleCustomization />
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
        <Route
          path="/points/history"
          element={
            <UserRoute>
              <PointsHistory />
            </UserRoute>
          }
        />
        <Route
          path="/rewards"
          element={
            <UserRoute>
              <RewardShop />
            </UserRoute>
          }
        />
        <Route path="/about" element={<About />} />
      </Routes>

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
