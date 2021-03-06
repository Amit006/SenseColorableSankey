senseSankey = function() {
  var sankey = {},
      nodeWidth = 24,
      nodePadding = 8,
      size = [1, 1],
      nodes = [],
      links = [];
 
  sankey.nodeWidth = function(_) {
    if (!arguments.length) return nodeWidth;
    nodeWidth = +_;
    return sankey;
  };
 
  sankey.nodePadding = function(_) {
    if (!arguments.length) return nodePadding;
    nodePadding = +_;
    return sankey;
  };
 
  sankey.nodes = function(_) {
    if (!arguments.length) return nodes;
    nodes = _;
    return sankey;
  };
 
  sankey.links = function(_) {
    if (!arguments.length) return links;
    links = _;
    return sankey;
  };
 
  sankey.size = function(_) {
    if (!arguments.length) return size;
    size = _;
    return sankey;
  };
 
  sankey.layout = function(iterations) {
    computeNodeLinks();
    computeNodeValues();
    computeNodeBreadths();
    computeNodeDepths(iterations);
    computeLinkDepths();
    return sankey;
  };
 
  sankey.relayout = function() {
    computeLinkDepths();
    return sankey;
  };
 
  sankey.link = function() {
    var curvature = .5;
 
    function link(d) {
      var x0 = d.source.x + d.source.dx,
          x1 = d.target.x,
          xi = d3.interpolateNumber(x0, x1),
          x2 = xi(curvature),
          x3 = xi(1 - curvature),
          y0 = d.source.y + d.sy + d.dy / 2,
          y1 = d.target.y + d.ty + d.dy / 2;
      return "M" + x0 + "," + y0
           + "C" + x2 + "," + y0
           + " " + x3 + "," + y1
           + " " + x1 + "," + y1;
    }
 
    link.curvature = function(_) {
      if (!arguments.length) return curvature;
      curvature = +_;
      return link;
    };
 
    return link;
  };
  
 
  // Populate the sourceLinks and targetLinks for each node.
  // Also, if the source and target are not objects, assume they are indices.
  function computeNodeLinks() {
    nodes.forEach(function(node) {
      node.sourceLinks = [];
      node.targetLinks = [];
    });
    links.forEach(function(link) {
      var source = link.source,
          target = link.target;
      if (typeof source === "number") source = link.source = nodes[link.source];
      if (typeof target === "number") target = link.target = nodes[link.target];
      //console.log('jrp5');
      source.sourceLinks.push(link);
      target.targetLinks.push(link);
      //console.log('jrp7')
    });
  }
 
  // Compute the value (size) of each node by summing the associated links.
  function computeNodeValues() {
    nodes.forEach(function(node) {
      node.value = Math.max(
        d3.sum(node.sourceLinks, value),
        d3.sum(node.targetLinks, value)
      );
    });
  }
 
  // JV Update 0.4: In original (I'm keeping the code until I'm confident about this), was finding x position by traversing tree and
  // placing target links as +1 from source. In the updated version I am using the dimIndex, which I've already calculated
  // so should both make sense and give a slight (negligible) performance boost  
  // JV Update 0.4.1: commented out moveSinksRight. We want to keep our nodes in their intended dimensional column
  function computeNodeBreadths() {
    var x = 0;
    nodes.forEach(function(node){
      node.x = node.dimIndex;
      node.dx = nodeWidth;

      x = Math.max(x, node.x);
    });
    x++;
    // Iteratively assign the breadth (x-position) for each node.
    // Nodes are assigned the maximum breadth of incoming neighbors plus one;
    // nodes with no incoming links are assigned breadth zero, while
    // nodes with no outgoing links are assigned the maximum breadth.
    /*
    var remainingNodes = nodes,
        nextNodes,
        x = 0;
 
    while (remainingNodes.length) {
      nextNodes = [];
      remainingNodes.forEach(function(node) {
        node.x = x;
        node.dx = nodeWidth;
        node.sourceLinks.forEach(function(link) {
          nextNodes.push(link.target);
        });
      });
      remainingNodes = nextNodes;
      ++x;
    }
    */
    
    //moveSinksRight(x);
    scaleNodeBreadths((size[0] - nodeWidth) / (x - 1));
  }
 
  function moveSourcesRight() {
    nodes.forEach(function(node) {
      if (!node.targetLinks.length) {
        node.x = d3.min(node.sourceLinks, function(d) { return d.target.x; }) - 1;
      }
    });
  }
 
  function moveSinksRight(x) {
    nodes.forEach(function(node) {
      if (!node.sourceLinks.length) {
        node.x = x - 1;
      }
    });
  }
 
  function scaleNodeBreadths(kx) {
    nodes.forEach(function(node) {
      node.x *= kx;
    });
  }
 
  function computeNodeDepths(iterations) {
    var nodesByBreadth = d3.nest()
        .key(function(d) { return d.x; })
        .sortKeys(d3.ascending)
        .entries(nodes)
        .map(function(d) { return d.values; });
 
    //
    initializeNodeDepth();
    resolveCollisions();
    for (var alpha = 1; iterations > 0; --iterations) {
      relaxRightToLeft(alpha *= .99);
      resolveCollisions();
      relaxLeftToRight(alpha);
      resolveCollisions();
    }
 
    function initializeNodeDepth() {
      var ky = d3.min(nodesByBreadth, function(nodes) {
        return (size[1] - (nodes.length - 1) * nodePadding) / d3.sum(nodes, value);
      });
 
      nodesByBreadth.forEach(function(nodes) {
        nodes.forEach(function(node, i) {
          node.y = i;
          node.dy = node.value * ky;
        });
      });
 
      links.forEach(function(link) {
        link.dy = link.value * ky;
      });
    }
 
    function relaxLeftToRight(alpha) {
      nodesByBreadth.forEach(function(nodes, breadth) {
        nodes.forEach(function(node) {
          if (node.targetLinks.length) {
            var y = d3.sum(node.targetLinks, weightedSource) / d3.sum(node.targetLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });
 
      function weightedSource(link) {
        return center(link.source) * link.value;
      }
    }
 
    function relaxRightToLeft(alpha) {
      nodesByBreadth.slice().reverse().forEach(function(nodes) {
        nodes.forEach(function(node) {
          if (node.sourceLinks.length) {
            var y = d3.sum(node.sourceLinks, weightedTarget) / d3.sum(node.sourceLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });
 
      function weightedTarget(link) {
        return center(link.target) * link.value;
      }
    }
 
    function resolveCollisions() {
      nodesByBreadth.forEach(function(nodes) {
        var node,
            dy,
            y0 = 0,
            n = nodes.length,
            i;
 
        // Push any overlapping nodes down.
        nodes.sort(customSorting);
        for (i = 0; i < n; ++i) {
          node = nodes[i];
          dy = y0 - node.y;
          if (dy > 0) node.y += dy;
          y0 = node.y + node.dy + nodePadding;
        }
 
        // If the bottommost node goes outside the bounds, push it back up.
        dy = y0 - nodePadding - size[1];
        if (dy > 0) {
          y0 = node.y -= dy;
 
          // Push any overlapping nodes back up.
          for (i = n - 2; i >= 0; --i) {
            node = nodes[i];
            dy = node.y + node.dy + nodePadding - y0;
            if (dy > 0) node.y -= dy;
            y0 = node.y;
          }
        }
      });
    }

    // JV update 0.2: using a custom sorting function here that checks whether there is a sortVal, else use default procedure
    function customSorting(a, b){
      if (a.sortVal != null && b.sortVal != null){
        if (typeof (a.sortVal) === "number" && typeof(b.sortVal) === "number"){
          if (typeof a.sortDir === "undefined" || a.sortDir){
            return a.sortVal - b.sortVal;
          } else{
            return b.sortVal - a.sortVal;
          }          
        } else {
          if (typeof a.sortDir === "undefined" || a.sortDir){
            return a.sortVal > b.sortVal ? 1 : (a.sortVal < b.sortVal ? -1 : 0);
          } else {
            return a.sortVal > b.sortVal ? -1 : (a.sortVal < b.sortVal ? 1 : 0);
          }
        }        
      } else {
        return a.y - b.y;
      }
    }

    // not in use
    function ascendingDepth(a, b) {
      return a.y - b.y;
    }
  }
 
  function computeLinkDepths() {
    nodes.forEach(function(node) {
      // JV: I am not sure why these are backwards, but this is how it came
      node.sourceLinks.sort(ascendingTargetDepth);
      node.targetLinks.sort(ascendingSourceDepth);
    });
    nodes.forEach(function(node) {
      var sy = 0, ty = 0;
      node.sourceLinks.forEach(function(link) {
        link.sy = sy;
        sy += link.dy;
      });
      node.targetLinks.forEach(function(link) {
        link.ty = ty;
        ty += link.dy;
      });
    });
 
    function ascendingSourceDepth(a, b) {
      return a.source.y - b.source.y;
    }
 
    function ascendingTargetDepth(a, b) {
      return a.target.y - b.target.y;
    }
  }
 
  function center(node) {
    return node.y + node.dy / 2;
  }
 
  function value(link) {
    return link.value;
  }
 
  return sankey;
};

	