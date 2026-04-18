import { Route, Routes } from "react-router-dom";
import Review from "./pages/Review";
import Upload from "./pages/Upload";

export default function App() {
  return (
    <Routes>
      <Route index element={<Upload />} />
      <Route path="review/:previewId" element={<Review />} />
    </Routes>
  );
}
