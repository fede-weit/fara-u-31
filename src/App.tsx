import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage, StoryReaderPage } from './pages';
import { Preloader } from './components/Preloader';

export default function App() {
  const [assetsReady, setAssetsReady] = useState(false);

  return (
    <>
      {!assetsReady && <Preloader onReady={() => setAssetsReady(true)} />}
      {assetsReady && (
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/story/:storyId" element={<StoryReaderPage />} />
          </Routes>
        </BrowserRouter>
      )}
    </>
  );
}
