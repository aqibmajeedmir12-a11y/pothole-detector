import LiveFeed from '../components/LiveFeed/LiveFeed';

export default function LiveFeedPage({ potholes, lastSensorData, isConnected }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Live Detection Feed</h1>
        <p className="text-sm text-gray-500 mt-1">Real-time pothole detections from all sources</p>
      </div>

      <LiveFeed 
        potholes={potholes} 
        sensorData={lastSensorData}
        isConnected={isConnected} 
      />
    </div>
  );
}
