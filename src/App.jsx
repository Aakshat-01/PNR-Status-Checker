import { useState } from 'react';

function App() {
  const [pnr, setPnr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  
  // Modal popup state
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');

  const API_KEY = "7a9abb51b1msh06651fe2fdfd61ap117955jsn4829814fbb57";
  const API_HOST = "irctc-indian-railway-pnr-status.p.rapidapi.com";

  const handleSearch = async (e) => {
    e.preventDefault();
    setError('');
    setData(null);

    const trimmedPnr = pnr.trim();
    const isValid = /^[0-9]{10}$/.test(trimmedPnr);

    if (!isValid) {
      setPopupMessage("PNR number should be exactly 10 digits");
      setShowPopup(true);
      return;
    }

    setLoading(true);

    // Mock Mode Check
    if (trimmedPnr === "1234567890") {
      setTimeout(() => {
        setData({
          TrainName: "Mumbai Rajdhani Express",
          TrainNo: "12951",
          SourceName: "Mumbai Central (MMCT)",
          DestinationName: "New Delhi (NDLS)",
          ChartPrepared: true,
          PassengerStatus: [
            {"Coach": "A1", "Berth": "22 (Lower)", "CurrentStatus": "CNF"},
            {"Coach": "A1", "Berth": "24 (Upper)", "CurrentStatus": "CNF"}
          ]
        });
        setLoading(false);
      }, 1000);
      return;
    }

    // Live API Query
    try {
      const url = `https://${API_HOST}/getPNRStatus/${trimmedPnr}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': API_KEY,
          'x-rapidapi-host': API_HOST
        }
      });

      if (response.status === 200) {
        const result = await response.json();
        if (result.success === false) {
          setError(result.message || "Failed to retrieve PNR status.");
        } else {
          const rawData = result.data ? result.data : result;
          
          // Helper function to resolve key case-insensitively
          const getKeyCI = (obj, ...keys) => {
            if (!obj || typeof obj !== 'object') return null;
            for (let k of keys) {
              if (k in obj) return obj[k];
              for (let key of Object.keys(obj)) {
                if (key.toLowerCase() === k.toLowerCase()) {
                  return obj[key];
                }
              }
            }
            return null;
          };

          const mappedData = {
            TrainName: getKeyCI(rawData, "TrainName", "trainName", "train_name"),
            TrainNo: getKeyCI(rawData, "TrainNo", "trainNo", "trainNumber", "train_number"),
            SourceName: getKeyCI(rawData, "SourceName", "sourceName", "from", "from_station", "source_name"),
            DestinationName: getKeyCI(rawData, "DestinationName", "destinationName", "to", "to_station", "destination_name"),
            ChartPrepared: getKeyCI(rawData, "ChartPrepared", "chartPrepared", "chart_prepared"),
          };

          const passengersRaw = getKeyCI(rawData, "PassengerStatus", "passengerStatus", "passengers", "passenger_status");
          const passengers = [];
          if (Array.isArray(passengersRaw)) {
            for (let p of passengersRaw) {
              if (p && typeof p === 'object') {
                passengers.push({
                  Coach: getKeyCI(p, "Coach", "coach"),
                  Berth: getKeyCI(p, "Berth", "berth", "seat", "seatNumber", "seat_number"),
                  CurrentStatus: getKeyCI(p, "CurrentStatus", "currentStatus", "status", "current_status")
                });
              }
            }
          }
          mappedData.PassengerStatus = passengers;
          setData(mappedData);
        }
      } else if (response.status === 401) {
        setError("Invalid API key. Please check configuration.");
      } else if (response.status === 404) {
        setError("Service not found. Try again later.");
      } else if (response.status >= 500) {
        setError("Server error. Please try again later.");
      } else {
        setError(`Unexpected error (Code: {response.status})`);
      }
    } catch (err) {
      setError("Something went wrong. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="icon">🚆</div>
      <div className="top-text">Trackoraa</div>
      <h1>PNR Status</h1>
      <p className="subtitle">Enter your PNR number to check train status</p>

      {/* Search Form */}
      <form onSubmit={handleSearch}>
        <div className="search-box">
          <input 
            type="text"
            value={pnr}
            onChange={(e) => setPnr(e.target.value)}
            placeholder="Enter PNR"
            maxLength="10"
            required
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? "⏳" : "🔍"}
          </button>
        </div>
      </form>

      {/* Error display */}
      {error && <p className="error">{error}</p>}

      {/* PNR Results */}
      {data && (
        <div className="result">
          <p><b>Train Name:</b> {data.TrainName || 'N/A'}</p>
          <p><b>Train Number:</b> {data.TrainNo || 'N/A'}</p>
          <p><b>From:</b> {data.SourceName || 'N/A'}</p>
          <p><b>To:</b> {data.DestinationName || 'N/A'}</p>
          <p>
            <b>PNR Status:</b> {data.ChartPrepared ? "✅ Chart Prepared" : "⏳ Chart Not Prepared"}
          </p>
          <h3>Passenger Details</h3>
          {data.PassengerStatus && data.PassengerStatus.length > 0 ? (
            data.PassengerStatus.map((p, index) => (
              <div key={index}>
                <p>Coach: {p.Coach || 'N/A'}</p>
                <p>Seat: {p.Berth || 'N/A'}</p>
                <p>Status: {p.CurrentStatus || 'N/A'}</p>
                {index < data.PassengerStatus.length - 1 && <hr />}
              </div>
            ))
          ) : (
            <p>No passenger details found.</p>
          )}
        </div>
      )}

      {/* Modal Alert Popup */}
      {showPopup && (
        <div className="popup">
          <div className="popup-content">
            <p>{popupMessage}</p>
            <button onClick={() => setShowPopup(false)}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
