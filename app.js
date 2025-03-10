// src/App.js
import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import { xml2js } from 'xml2js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

function App() {
  const [kmlData, setKmlData] = useState(null);
  const [mapElements, setMapElements] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [detailedData, setDetailedData] = useState(null);
  const [error, setError] = useState('');

  // Handle KML file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/vnd.google-earth.kml+xml') {
      const reader = new FileReader();
      reader.onload = (e) => {
        parseKml(e.target.result);
      };
      reader.readAsText(file);
    } else {
      setError('Please upload a valid KML file.');
    }
  };

  // Parse KML file
  const parseKml = (kmlString) => {
    xml2js(kmlString, { explicitArray: false }, (err, result) => {
      if (err) {
        setError('Error parsing KML file.');
        return;
      }
      setKmlData(result);
      extractElements(result);
    });
  };

  // Extract KML elements and calculate counts and lengths
  const extractElements = (data) => {
    const elements = [];
    let elementCounts = { Point: 0, LineString: 0, MultiLineString: 0, Placemark: 0 };
    let detailedElements = [];

    // Helper function to calculate length of a LineString (in meters)
    const calculateLength = (coordinates) => {
      let totalLength = 0;
      for (let i = 0; i < coordinates.length - 1; i++) {
        const [lon1, lat1] = coordinates[i];
        const [lon2, lat2] = coordinates[i + 1];
        totalLength += calculateDistance(lon1, lat1, lon2, lat2);
      }
      return totalLength;
    };

    // Helper function to calculate distance between two lat/lon points (Haversine formula)
    const calculateDistance = (lon1, lat1, lon2, lat2) => {
      const R = 6371000; // meters
      const φ1 = lat1 * (Math.PI / 180);
      const φ2 = lat2 * (Math.PI / 180);
      const Δφ = (lat2 - lat1) * (Math.PI / 180);
      const Δλ = (lon2 - lon1) * (Math.PI / 180);

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // Traverse KML data to count elements and extract details
    const placemarks = data.kml.Document.Placemark;
    placemarks.forEach((placemark) => {
      elementCounts.Placemark++;

      if (placemark.Point) {
        elementCounts.Point++;
        const coordinates = placemark.Point.coordinates.split(',').map(coord => parseFloat(coord));
        elements.push({
          type: 'Point',
          position: [coordinates[1], coordinates[0]],
        });
      }

      if (placemark.LineString) {
        elementCounts.LineString++;
        const coordinates = placemark.LineString.coordinates.split(' ').map(coord => {
          const [lon, lat] = coord.split(',').map(Number);
          return [lon, lat];
        });
        const length = calculateLength(coordinates);
        detailedElements.push({
          type: 'LineString',
          length,
          coordinates,
        });
        elements.push({
          type: 'LineString',
          coordinates: placemark.LineString.coordinates.split(' ').map(coord => {
            const [lon, lat] = coord.split(',').map(Number);
            return [lon, lat];
          }),
        });
      }

      if (placemark.MultiGeometry) {
        placemark.MultiGeometry.LineString.forEach((lineString) => {
          elementCounts.MultiLineString++;
          const coordinates = lineString.coordinates.split(' ').map(coord => {
            const [lon, lat] = coord.split(',').map(Number);
            return [lon, lat];
          });
          const length = calculateLength(coordinates);
          detailedElements.push({
            type: 'MultiLineString',
            length,
            coordinates,
          });
          elements.push({
            type: 'MultiLineString',
            coordinates,
          });
        });
      }
    });

    setMapElements(elements);
    setSummaryData(elementCounts);
    setDetailedData(detailedElements);
  };

  return (
    <div className="App">
      <h1>KML File Parser and Map Viewer</h1>
      <input type="file" accept=".kml" onChange={handleFileUpload} />
      {error && <div style={{ color: 'red' }}>{error}</div>}

      {summaryData && (
        <div>
          <button onClick={() => setSummaryData(summaryData)}>Summary</button>
          <table border="1">
            <thead>
              <tr>
                <th>Element Type</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(summaryData).map((key) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{summaryData[key]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailedData && (
        <div>
          <button onClick={() => setDetailedData(detailedData)}>Detailed</button>
          <table border="1">
            <thead>
              <tr>
                <th>Element Type</th>
                <th>Length (meters)</th>
              </tr>
            </thead>
            <tbody>
              {detailedData.map((data, index) => (
                <tr key={index}>
                  <td>{data.type}</td>
                  <td>{data.length.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MapContainer center={[51.505, -0.09]} zoom={13} style={{ height: '400px', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {mapElements.map((element, index) => {
          if (element.type === 'Point') {
            return (
              <Marker key={index} position={element.position}>
                <Popup>Point</Popup>
              </Marker>
            );
          } else if (element.type === 'LineString' || element.type === 'MultiLineString') {
            return <Polyline key={index} positions={element.coordinates} color="blue" />;
          }
          return null;
        })}
      </MapContainer>
    </div>
  );
}

export default App;
