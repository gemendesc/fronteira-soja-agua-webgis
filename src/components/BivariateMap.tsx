import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  BIVARIATE_COLORS,
  BIVARIATE_LABELS,
  EIXO_Y_META,
  RECORTE_META,
  formatCompact,
  formatNumber,
} from "../bivariate";
import type { EixoYKey, MunicipioSummary, RecorteKey } from "../types";

interface Props {
  geometries: GeoJSON.FeatureCollection | null;
  municipalities: MunicipioSummary[];
  recorte: RecorteKey;
  eixoY: EixoYKey;
  selectedClass: string | null;
  selectedMunId: string | null;
  flyTarget: { lon: number; lat: number } | null;
  onSelectMunicipality: (cdMun: string) => void;
}

const PAPER_BASEMAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "esri-light-base": {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        "Base: Esri, HERE, OpenStreetMap · Fontes: INPE/PRODES, IBGE/PAM, ANA/SNIRH, MDIC/Comex Stat",
    },
    "esri-light-labels": {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: "basemap-paper",
      type: "raster",
      source: "esri-light-base",
      minzoom: 0,
      maxzoom: 16,
    },
  ],
};

export const BivariateMap: React.FC<Props> = ({
  geometries,
  municipalities,
  recorte,
  eixoY,
  selectedClass,
  selectedMunId,
  flyTarget,
  onSelectMunicipality,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const onSelectRef = useRef(onSelectMunicipality);
  onSelectRef.current = onSelectMunicipality;

  const eixoMetaRef = useRef(EIXO_Y_META[eixoY]);
  eixoMetaRef.current = EIXO_Y_META[eixoY];

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: PAPER_BASEMAP_STYLE,
      bounds: RECORTE_META.todos.bounds,
      fitBoundsOptions: { padding: 32 },
      maxZoom: 11.5,
      minZoom: 3,
      scrollZoom: false, // Evita sequestrar a rolagem da página editorial; botões +/- continuam ativos
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");

    // Permite zoom com Ctrl + Scroll para quem desejar navegar rápido
    map.getCanvas().addEventListener("wheel", (ev) => {
      if (ev.ctrlKey || ev.metaKey) {
        ev.preventDefault();
        if (!map.scrollZoom.isEnabled()) map.scrollZoom.enable();
      } else if (map.scrollZoom.isEnabled()) {
        map.scrollZoom.disable();
      }
    });

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: "geo-hover-popup",
      offset: 12,
    });
    popupRef.current = popup;

    map.on("load", () => {
      map.addSource("municipios-src", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "municipios-fill",
        type: "fill",
        source: "municipios-src",
        paint: {
          "fill-color": ["coalesce", ["get", "fill_color"], "#eceeeb"],
          "fill-opacity": ["coalesce", ["get", "fill_opacity"], 0.88],
        },
      });

      map.addLayer({
        id: "municipios-outline",
        type: "line",
        source: "municipios-src",
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "is_selected"], true],
            "#1e2328",
            ["==", ["get", "biv_class"], "C3"],
            "rgba(30, 35, 40, 0.55)",
            "rgba(61, 69, 75, 0.24)",
          ],
          "line-width": [
            "case",
            ["==", ["get", "is_selected"], true],
            2.4,
            ["==", ["get", "biv_class"], "C3"],
            0.85,
            0.35,
          ],
        },
      });

      map.addLayer({
        id: "basemap-labels-top",
        type: "raster",
        source: "esri-light-labels",
        paint: { "raster-opacity": 0.82 },
      });

      map.on("mousemove", "municipios-fill", (e) => {
        const feat = e.features?.[0];
        if (!feat || !feat.properties) return;
        const p = feat.properties;
        if (!p.in_filter) {
          map.getCanvas().style.cursor = "default";
          popup.remove();
          return;
        }
        map.getCanvas().style.cursor = "pointer";
        const yMeta = eixoMetaRef.current;
        const badgeColor = BIVARIATE_COLORS[p.biv_class] || "#3d454b";
        const darkText = ["A1", "A2", "B1"].includes(String(p.biv_class));
        const bivDesc = BIVARIATE_LABELS[p.biv_class] || p.biv_class;

        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="tt-card">
              <div class="tt-head">
                <strong>${p.nm_mun} · ${p.sigla_uf}</strong>
                <span class="tt-badge" style="background:${badgeColor};color:${
                  darkText ? "#1e2328" : "#fff"
                }">${p.biv_class}</span>
              </div>
              <div class="tt-sub">${p.bioma_predominante}${p.fl_matopiba ? " · MATOPIBA" : ""}${
                p.fl_arco_desmatamento ? " · Arco Desmat." : ""
              }</div>
              <div class="tt-metrics">
                <div><span>Supressão PRODES:</span> <strong>${formatNumber(Number(p.desmat_km2), 1)} km²</strong></div>
                <div><span>${yMeta.shortLabel}:</span> <strong>${formatCompact(Number(p.y_value), 1)} ${yMeta.unit}</strong></div>
                <div><span>Soja colhida (PAM):</span> <strong>${formatCompact(Number(p.pam_ton), 1)} t</strong></div>
                <div><span>Irrigação azul (ANA):</span> <strong>${formatNumber(Number(p.irrig_hm3), 1)} hm³</strong></div>
                <div><span>Exp. fiscal (Comex):</span> <strong>${
                  Number(p.comex_ton) > 0 ? `${formatCompact(Number(p.comex_ton), 1)} t` : "0 t (via polo)"
                }</strong></div>
              </div>
              <div class="tt-foot">${bivDesc} · Clique p/ abrir diagnóstico municipal</div>
            </div>`
          )
          .addTo(map);
      });

      map.on("mouseleave", "municipios-fill", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      map.on("click", "municipios-fill", (e) => {
        const feat = e.features?.[0];
        if (feat?.properties?.cd_mun && feat.properties.in_filter) {
          onSelectRef.current(String(feat.properties.cd_mun));
        }
      });

      setMapReady(true);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !geometries) return;
    const src = mapRef.current.getSource("municipios-src") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    const summaryByMun = new Map<string, MunicipioSummary>();
    for (const m of municipalities) {
      summaryByMun.set(m.cd_mun, m);
    }

    const mergedFeatures = geometries.features.map((feat: any) => {
      const cdMun = String(feat.properties?.cd_mun || feat.id);
      const metric = summaryByMun.get(cdMun);
      const inFilter = Boolean(metric);
      const bivClass = metric?.biv_class || "OUT";
      const matchesClass = !selectedClass || bivClass === selectedClass;
      const isSelected = selectedMunId === cdMun;

      return {
        ...feat,
        properties: {
          ...feat.properties,
          in_filter: inFilter,
          biv_class: bivClass,
          is_selected: isSelected,
          desmat_km2: metric?.desmat_km2 ?? 0,
          y_value: metric?.y_value ?? 0,
          pam_ton: metric?.pam_ton ?? 0,
          comex_ton: metric?.comex_ton ?? 0,
          irrig_hm3: metric?.irrig_hm3 ?? 0,
          fill_color: inFilter ? BIVARIATE_COLORS[bivClass] || "#dfe3de" : "#e6e8e5",
          fill_opacity: !inFilter
            ? 0.35
            : isSelected
            ? 0.98
            : matchesClass
            ? 0.88
            : 0.16,
        },
      };
    });

    src.setData({
      type: "FeatureCollection",
      features: mergedFeatures,
    });
  }, [mapReady, geometries, municipalities, selectedClass, selectedMunId]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const bounds = RECORTE_META[recorte]?.bounds || RECORTE_META.todos.bounds;
    mapRef.current.fitBounds(bounds, { padding: 36, duration: 850 });
  }, [mapReady, recorte]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !flyTarget) return;
    mapRef.current.flyTo({
      center: [flyTarget.lon, flyTarget.lat],
      zoom: Math.max(mapRef.current.getZoom(), 6.6),
      duration: 900,
    });
  }, [mapReady, flyTarget]);

  return <div ref={containerRef} className="map-canvas" />;
};
