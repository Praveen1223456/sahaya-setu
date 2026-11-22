import React, { useEffect, useRef } from 'react';
import { getImageUrl, FALLBACK_IMAGE } from '../utils/imageUrl';

const STATUS_COLORS = {
  received: '#2563eb', // blue
  assigned: '#d97706', // amber
  in_progress: '#ea580c', // orange
  resolved: '#16a34a', // green
  closed: '#475569', // slate
  escalated: '#dc2626', // red
  emergency: '#b91c1c', // deep crimson
};

export default function InteractiveMap({
  center = [16.5787, 82.0061],
  zoom = 13,
  height = '420px',
  markers = [],
  disasterZones = [],
  selectable = false,
  selectedLocation = null,
  onLocationSelect = null,
  onMarkerClick = null,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerGroupRef = useRef(null);
  const disasterGroupRef = useRef(null);
  const selectionMarkerRef = useRef(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (typeof window.L === 'undefined') return;

    if (!mapInstanceRef.current) {
      const map = window.L.map(mapContainerRef.current).setView(center, zoom);

      // Neutral offline fallback tile if OpenStreetMap tile servers are unreachable or offline
      const offlineTileUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="%23f8fafc" stroke="%23e2e8f0" stroke-width="1"/><circle cx="128" cy="128" r="4" fill="%23cbd5e1"/></svg>`;

      const tileLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
        errorTileUrl: offlineTileUrl,
      });

      tileLayer.on('tileerror', () => {
        // Handled gracefully by errorTileUrl fallback
      });

      tileLayer.addTo(map);

      disasterGroupRef.current = window.L.layerGroup().addTo(map);
      markerGroupRef.current = window.L.layerGroup().addTo(map);

      // Handle map clicks in selectable mode
      map.on('click', (e) => {
        if (selectable && onLocationSelect) {
          onLocationSelect(e.latlng.lat, e.latlng.lng);
        }
      });

      mapInstanceRef.current = map;
    }

    return () => {
      // Don't destroy on every render, keep reference clean
    };
  }, []);

  // Update center & zoom
  useEffect(() => {
    if (mapInstanceRef.current && center && center[0] && center[1]) {
      mapInstanceRef.current.setView(center, zoom);
    }
  }, [center[0], center[1], zoom]);

  // Update Selection Marker (Draggable Pin)
  useEffect(() => {
    if (!mapInstanceRef.current || !selectable) return;
    const L = window.L;
    if (!L) return;

    if (selectedLocation && selectedLocation.lat && selectedLocation.lng) {
      const pos = [selectedLocation.lat, selectedLocation.lng];
      if (selectionMarkerRef.current) {
        selectionMarkerRef.current.setLatLng(pos);
      } else {
        const marker = L.marker(pos, {
          draggable: true,
          title: 'Drag me to adjust location',
        }).addTo(mapInstanceRef.current);

        marker.on('dragend', () => {
          const latlng = marker.getLatLng();
          if (onLocationSelect) {
            onLocationSelect(latlng.lat, latlng.lng);
          }
        });

        marker.bindPopup('<b>Selected Location</b><br>Drag to fine-tune map pin').openPopup();
        selectionMarkerRef.current = marker;
      }
    }
  }, [selectedLocation?.lat, selectedLocation?.lng, selectable]);

  // Update Disaster Zones (Translucent Circles)
  useEffect(() => {
    if (!disasterGroupRef.current || !window.L) return;
    const L = window.L;
    disasterGroupRef.current.clearLayers();

    disasterZones.forEach((zone) => {
      if (zone.center_lat && zone.center_lon) {
        L.circle([zone.center_lat, zone.center_lon], {
          radius: (zone.radius_km || 20) * 1000,
          color: '#dc2626',
          fillColor: '#ef4444',
          fillOpacity: 0.18,
          weight: 2,
          dashArray: '5, 5',
        })
          .bindTooltip(`🚨 <b>${zone.title}</b><br>Area: ${zone.areaName}`)
          .addTo(disasterGroupRef.current);
      }
    });
  }, [disasterZones]);

  // Update Incident Markers
  useEffect(() => {
    if (!markerGroupRef.current || !window.L) return;
    const L = window.L;
    markerGroupRef.current.clearLayers();

    markers.forEach((inc) => {
      if (inc.lat && inc.lon) {
        const color = inc.is_disaster_mode
          ? STATUS_COLORS.emergency
          : STATUS_COLORS[inc.status] || '#1b4f9c';

        const circle = L.circleMarker([inc.lat, inc.lon], {
          radius: inc.is_disaster_mode ? 10 : 8,
          fillColor: color,
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        });

        const popupPhoto = (inc.images && inc.images[0]) || inc.best_photo_path || inc.photo_url;
        const resolvedPopupImg = popupPhoto ? getImageUrl(popupPhoto) : null;

        const popupContent = document.createElement('div');
        popupContent.style.minWidth = '220px';
        popupContent.style.fontFamily = 'sans-serif';
        popupContent.innerHTML = `
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px; color: #0f172a;">
            ${inc.ticket_code || `SS-${inc.id}`}: ${inc.category}
          </div>
          <div style="font-size: 12px; color: #475569; margin-bottom: 6px;">
            ${inc.address || 'Location provided'}
          </div>
          <div style="display: flex; gap: 6px; margin-bottom: 8px;">
            <span style="background: ${color}; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase;">
              ${inc.status}
            </span>
            <span style="background: #f1f5f9; color: #334155; padding: 2px 6px; border-radius: 4px; font-size: 11px;">
              Priority: ${Math.round(inc.priority || 0)}
            </span>
          </div>
          ${
            resolvedPopupImg
              ? `<img src="${resolvedPopupImg}" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';" style="width: 100%; height: 90px; object-fit: cover; border-radius: 6px; margin-bottom: 6px; background-color: #f1f5f9;" />`
              : ''
          }
          <div style="font-size: 11px; color: #64748b;">
            Dept: <b>${(inc.department || '').toUpperCase()}</b>
          </div>
        `;

        circle.bindPopup(popupContent);

        if (onMarkerClick) {
          circle.on('click', () => onMarkerClick(inc));
        }

        circle.addTo(markerGroupRef.current);
      }
    });
  }, [markers]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: '100%',
        height: height,
        borderRadius: '10px',
        border: '1px solid #cbd5e1',
        overflow: 'hidden',
        zIndex: 1,
      }}
    />
  );
}
