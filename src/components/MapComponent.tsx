import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface MapComponentProps {
  onRegionClick: (regionName: string) => void;
  selectedRegionName?: string;
}

export const MapComponent: React.FC<MapComponentProps> = ({ onRegionClick, selectedRegionName }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/gazraim-png/qazaqgeo-learn/main/src/data/kazakhstan-regions.json')
      .then(res => res.json())
      .then(data => {
        setGeoData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading GeoJSON:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!geoData || !svgRef.current) return;
    console.log('MapComponent: Rendering map for', selectedRegionName || 'all regions');

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    if (width === 0 || height === 0) return;

    // Initialize or select the main group
    let g = svg.select<SVGGElement>('g.map-content');
    if (g.empty()) {
      g = svg.append('g').attr('class', 'map-content');
      
      // Add a background rect to catch clicks on empty space if needed
      svg.on('click', (event) => {
        if (event.target === svg.node()) {
          console.log('SVG background clicked');
        }
      });
    }

    const projection = d3.geoMercator();
    
    // Determine what to fit in the view
    const selectedFeature = geoData.features.find((f: any) => f.properties.NAME_1 === selectedRegionName);
    const fitTarget = selectedFeature ? selectedFeature : geoData;
    
    projection.fitSize([width * 0.9, height * 0.9], fitTarget);
    // Center the projection
    const center = projection.center();
    projection.center(center);

    const pathGenerator = d3.geoPath().projection(projection);

    // Update paths
    const paths = g.selectAll<SVGPathElement, any>('path')
      .data(geoData.features, (d: any) => d.properties.NAME_2 || d.properties.NAME_1);

    // Enter
    const pathsEnter = paths.enter()
      .append('path')
      .attr('class', 'cursor-pointer transition-all duration-300')
      .attr('stroke', '#d4d4d8')
      .attr('stroke-width', 1)
      .attr('fill', '#f4f4f5');

    // Merge and Transition
    const mergedPaths = paths.merge(pathsEnter);
    
    mergedPaths
      .on('click', (event, d: any) => {
        const name = d.properties.NAME_2 || d.properties.NAME_1;
        console.log('Region clicked:', name);
        onRegionClick(name);
      })
      .on('mousemove', (event) => {
        setMousePos({ x: event.clientX, y: event.clientY });
      })
      .on('mouseenter', function(event, d: any) {
        const name = d.properties.NAME_2 || d.properties.NAME_1;
        setHoveredRegion(name);
        if (name !== selectedRegionName) {
          d3.select(this)
            .transition()
            .duration(200)
            .attr('fill', '#e4e4e7')
            .attr('stroke', '#a1a1aa')
            .attr('stroke-width', 1.5);
        }
      })
      .on('mouseleave', function(event, d: any) {
        setHoveredRegion(null);
        const name = d.properties.NAME_2 || d.properties.NAME_1;
        if (name !== selectedRegionName) {
          d3.select(this)
            .transition()
            .duration(200)
            .attr('fill', '#f4f4f5')
            .attr('stroke', '#d4d4d8')
            .attr('stroke-width', 1);
        }
      });

    mergedPaths
      .transition()
      .duration(750)
      .ease(d3.easeCubicInOut)
      .attr('d', (d: any) => pathGenerator(d))
      .attr('fill', (d: any) => {
        const name = d.properties.NAME_2 || d.properties.NAME_1;
        return name === selectedRegionName ? '#18181b' : '#f4f4f5';
      })
      .attr('stroke', (d: any) => {
        const name = d.properties.NAME_2 || d.properties.NAME_1;
        return name === selectedRegionName ? '#000' : '#d4d4d8';
      })
      .attr('stroke-width', (d: any) => {
        const name = d.properties.NAME_2 || d.properties.NAME_1;
        return name === selectedRegionName ? 2 : 1;
      });

    // Exit
    paths.exit().remove();

    // Update labels
    const labels = g.selectAll<SVGTextElement, any>('text')
      .data(geoData.features, (d: any) => d.properties.NAME_2 || d.properties.NAME_1);

    // Enter
    const labelsEnter = labels.enter()
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('font-weight', '600')
      .attr('pointer-events', 'none')
      .style('opacity', 0);

    // Merge and Transition
    labels.merge(labelsEnter)
      .transition()
      .duration(750)
      .ease(d3.easeCubicInOut)
      .attr('x', (d: any) => pathGenerator.centroid(d)[0])
      .attr('y', (d: any) => pathGenerator.centroid(d)[1])
      .attr('font-size', (d: any) => {
        const name = d.properties.NAME_2 || d.properties.NAME_1;
        return name === selectedRegionName ? '14px' : '8px';
      })
      .attr('fill', (d: any) => {
        const name = d.properties.NAME_2 || d.properties.NAME_1;
        return name === selectedRegionName ? '#fff' : '#71717a';
      })
      .style('opacity', (d: any) => {
        const name = d.properties.NAME_2 || d.properties.NAME_1;
        if (name === selectedRegionName) return 1;
        if (selectedRegionName) return 0;
        return name.length > 15 ? 0 : 1;
      })
      .text((d: any) => d.properties.NAME_2 || d.properties.NAME_1);

    // Exit
    labels.exit().remove();

  }, [geoData, selectedRegionName]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-50 rounded-3xl border border-zinc-200">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 font-medium">Загрузка карты...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <svg 
        ref={svgRef} 
        className="w-full h-full bg-zinc-50 rounded-3xl border border-zinc-200"
      />
      {hoveredRegion && (
        <div 
          className="fixed pointer-events-none z-[100] px-3 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-lg shadow-xl"
          style={{ 
            left: mousePos.x + 15, 
            top: mousePos.y - 15 
          }}
        >
          {hoveredRegion}
        </div>
      )}
    </div>
  );
};
