import * as d3 from 'd3';

export function appendGlowFilter(
  defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
  id: string,
  stdDeviation = 3,
) {
  const filter = defs.append('filter').attr('id', id);
  filter.append('feGaussianBlur').attr('stdDeviation', String(stdDeviation)).attr('result', 'coloredBlur');
  const feMerge = filter.append('feMerge');
  feMerge.append('feMergeNode').attr('in', 'coloredBlur');
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
}

export function appendArrowMarker(
  defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
  id: string,
  color: string,
  refX = 35,
) {
  defs
    .append('marker')
    .attr('id', id)
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', refX)
    .attr('refY', 0)
    .attr('markerWidth', 8)
    .attr('markerHeight', 8)
    .attr('orient', 'auto')
    .append('path')
    .attr('fill', color)
    .attr('d', 'M0,-5L10,0L0,5');
}

export function createDragBehavior<T extends d3.SimulationNodeDatum>(
  simulation: d3.Simulation<T, any>,
) {
  return d3
    .drag<SVGGElement, T>()
    .on('start', (event, d) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on('drag', (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });
}

export function getContainerDimensions(svgElement: SVGSVGElement): { width: number; height: number } {
  const parent = svgElement.parentElement;
  return {
    width: parent?.clientWidth || svgElement.clientWidth || 600,
    height: parent?.clientHeight || svgElement.clientHeight || 400,
  };
}
