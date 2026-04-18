import { Routes, Route } from "react-router-dom";
import Upload from "./pages/Upload";
import Review from "./pages/Review";

export default function App() {
  return (
    <Routes>
      <Route index element={<Upload />} />
      <Route path="review/:previewId" element={<Review />} />
    </Routes>
  );
}
