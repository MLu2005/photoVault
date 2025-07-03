import { Link, Routes, Route, useParams } from 'react-router-dom';

const events = ['wakacje-2024', 'czerwiec-2024', 'sylwester'];
const photos = {
  'wakacje-2024': [
    { src: 'https://via.placeholder.com/100', title: 'Plaża' },
    { src: 'https://via.placeholder.com/100', title: 'Morze' },
  ]
};

function EventGallery() {
  const { event } = useParams();
  const imgs = photos[event] || [];
  return (
    <div>
      <h2 className='text-xl font-bold mb-4'>Public Gallery for: {event}</h2>
      <div className='flex gap-6'>
        {imgs.map((img, idx) => (
          <div key={idx} className='text-center'>
            <img src={img.src} alt={img.title} className='w-32 h-32 object-cover' />
            <p>{img.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PublicGallery() {
  return (
    <div>
      <div className='bg-gray-800 text-white p-4 mb-4'>
        <h2 className='text-2xl mb-2'>Public Gallery</h2>
        <nav className='space-x-4'>
          {events.map(event => <Link key={event} to={`/public/${event}`} className='hover:underline'>{event}</Link>)}
        </nav>
      </div>
      <Routes>
        <Route path=':event' element={<EventGallery />} />
      </Routes>
    </div>
  );
}