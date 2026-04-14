import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage, StoryReaderPage } from './pages';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/story/:storyId" element={<StoryReaderPage />} />
      </Routes>
    </BrowserRouter>
  );
}

