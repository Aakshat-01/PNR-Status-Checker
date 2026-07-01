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
          DateOfJourney: "Feb 9, 2025 11:30:05 AM",
          SourceName: "Mumbai Central (MMCT)",
          DestinationName: "New Delhi (NDLS)",
          ChartPrepared: "Chart Prepared",
          PassengerStatus: [
            {
              SerialNumber: 1,
              Coach: "A1",
              CurrentStatusDetails: "CNF 22",
              BookingStatusDetails: "CNF 22",
              CurrentStatusCode: "CNF"
            },
            {
              SerialNumber: 2,
              Coach: "A1",
              CurrentStatusDetails: "CNF 24",
              BookingStatusDetails: "CNF 24",
              CurrentStatusCode: "CNF"
            }
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
            DateOfJourney: getKeyCI(
              rawData,
              "DateOfJourney", "dateOfJourney", "date_of_journey", "doj"
            ),
            SourceName: getKeyCI(
              rawData,
              "SourceName", "sourceName", "sourceStation",
              "from", "from_station", "source_name"
            ),
            DestinationName: getKeyCI(
              rawData,
              "DestinationName", "destinationName", "destinationStation",
              "to", "to_station", "destination_name"
            ),
            // API returns a string like "Chart Prepared" / "Chart Not Prepared",
            // not a boolean, so we keep it as-is and check it in the render.
            ChartPrepared: getKeyCI(
              rawData,
              "ChartPrepared", "chartPrepared", "chartStatus", "chart_prepared"
            ),
          };

          const passengersRaw = getKeyCI(
            rawData,
            "PassengerStatus", "passengerStatus", "passengers",
            "passengerList", "passenger_status"
          );

          const passengers = [];
          if (Array.isArray(passengersRaw)) {
            for (let p of passengersRaw) {
              if (p && typeof p === 'object') {
                const serialNumber = getKeyCI(
                  p, "SerialNumber", "serialNumber", "passengerSerialNumber", "serial_number"
                );
                const coach = getKeyCI(
                  p, "Coach", "coach", "currentCoachId", "bookingCoachId"
                );

                // Prefer a pre-built detail string from the API (e.g. "RAC 36"),
                // otherwise construct one from the status code + berth number.
                const currentStatusCode = getKeyCI(
                  p, "CurrentStatus", "currentStatus", "status", "current_status"
                );
                const currentBerth = getKeyCI(
                  p, "Berth", "berth", "seat", "currentBerthNo"
                );
                const currentStatusDetails = getKeyCI(
                  p, "CurrentStatusDetails", "currentStatusDetails"
                ) || [currentStatusCode, currentBerth].filter(Boolean).join(" ");

                const bookingStatusCode = getKeyCI(p, "bookingStatus");
                const bookingBerth = getKeyCI(p, "bookingBerthNo");
                const bookingStatusDetails = getKeyCI(
                  p, "BookingStatusDetails", "bookingStatusDetails"
                ) || [bookingStatusCode, bookingBerth].filter(Boolean).join(" ");

                passengers.push({
                  SerialNumber: serialNumber || null,
                  Coach: coach || null,
                  CurrentStatusCode: currentStatusCode || null,
                  CurrentStatusDetails: currentStatusDetails || null,
                  BookingStatusDetails: bookingStatusDetails || null
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
        setError(`Unexpected error (Code: ${response.status})`);
      }
    } catch (err) {
      setError("Something went wrong. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  // Maps a raw status code (CNF, RAC, WL, CAN, etc.) to a friendly
  // sub-label and color, similar to how IRCTC apps display it.
  const getStatusMeta = (statusCode) => {
    if (!statusCode) return { label: '', color: '#6b7280' };
    const code = statusCode.toUpperCase();
    if (code.startsWith('CNF')) return { label: 'Confirmed', color: '#16a34a' };
    if (code.startsWith('RAC')) return { label: 'Available', color: '#16a34a' };
    if (code.startsWith('WL') || code.includes('WL')) return { label: 'Waitlisted', color: '#d97706' };
    if (code.startsWith('CAN')) return { label: 'Cancelled', color: '#dc2626' };
    return { label: '', color: '#6b7280' };
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
          <p><b>Date of Journey:</b> {data.DateOfJourney || 'N/A'}</p>
          <p><b>From:</b> {data.SourceName || 'N/A'}</p>
          <p><b>To:</b> {data.DestinationName || 'N/A'}</p>
          <p>
            <b>PNR Status:</b>{" "}
            {data.ChartPrepared === "Chart Prepared"
              ? "✅ Chart Prepared"
              : `⏳ ${data.ChartPrepared || "Not Available"}`}
          </p>
          <h3>Passenger Status</h3>
          {data.PassengerStatus && data.PassengerStatus.length > 0 ? (
            <table className="passenger-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: '0.85rem' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 500 }}>S. No</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500 }}>Current Status</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500 }}>Booking Status</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500 }}>Coach</th>
                </tr>
              </thead>
              <tbody>
                {data.PassengerStatus.map((p, index) => {
                  const meta = getStatusMeta(p.CurrentStatusCode);
                  return (
                    <tr key={index} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '10px 12px' }}>{p.SerialNumber || index + 1}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div>{p.CurrentStatusDetails || 'N/A'}</div>
                        {meta.label && (
                          <div style={{ fontSize: '0.8rem', color: meta.color }}>
                            {meta.label}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{p.BookingStatusDetails || 'N/A'}</td>
                      <td style={{ padding: '10px 12px' }}>{p.Coach || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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