import "./DashboardCards.css";

export default function DashboardCards({ stats }) {
  return (
    <div className="cards">
      <div className="card">
        <h3>Vehicles</h3>
        <h1>{stats.vehicles}</h1>
      </div>

      <div className="card">
        <h3>Drivers</h3>
        <h1>{stats.drivers}</h1>
      </div>

      <div className="card">
        <h3>Shipments</h3>
        <h1>{stats.shipments}</h1>
      </div>

      <div className="card">
        <h3>Trips</h3>
        <h1>{stats.trips}</h1>
      </div>
    </div>
  );
}