import { calculateDistance } from 'geolib';

/**
 * Optimize route for multiple deliveries using greedy nearest neighbor algorithm
 * This is a simplified version - for production use TSP algorithms or APIs like Google Maps Routes
 */
export const optimizeRoute = (deliveries, startLocation) => {
  if (deliveries.length === 0) return [];
  if (deliveries.length === 1) return deliveries;

  const optimized = [];
  const remaining = [...deliveries];
  let currentLocation = startLocation;
  let totalDistance = 0;

  // Greedy nearest neighbor approach
  while (remaining.length > 0) {
    let nearest = remaining[0];
    let nearestDistance = calculateDistance(
      { latitude: currentLocation.lat, longitude: currentLocation.lon },
      { latitude: nearest.delivery_location.lat, longitude: nearest.delivery_location.lon }
    );
    let nearestIndex = 0;

    // Find nearest unvisited delivery
    for (let i = 1; i < remaining.length; i++) {
      const distance = calculateDistance(
        { latitude: currentLocation.lat, longitude: currentLocation.lon },
        { latitude: remaining[i].delivery_location.lat, longitude: remaining[i].delivery_location.lon }
      );

      if (distance < nearestDistance) {
        nearest = remaining[i];
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    optimized.push(nearest);
    totalDistance += nearestDistance;
    currentLocation = {
      lat: nearest.delivery_location.lat,
      lon: nearest.delivery_location.lon,
    };
    remaining.splice(nearestIndex, 1);
  }

  return {
    route: optimized,
    totalDistance,
    estimatedTime: Math.ceil((totalDistance / 1000) / 40 * 60), // Assuming 40 km/h average
  };
};

/**
 * Calculate batch delivery recommendations
 * Suggests which deliveries can be done together based on location proximity
 */
export const calculateBatches = (deliveries, maxDeliveries = 5, maxDistance = 50000) => {
  const batches = [];
  const processed = new Set();

  deliveries.forEach((delivery, index) => {
    if (processed.has(index)) return;

    const batch = [delivery];
    processed.add(index);

    // Find nearby deliveries
    deliveries.forEach((otherDelivery, otherIndex) => {
      if (processed.has(otherIndex) || batch.length >= maxDeliveries) return;

      const distance = calculateDistance(
        { latitude: delivery.delivery_location.lat, longitude: delivery.delivery_location.lon },
        { latitude: otherDelivery.delivery_location.lat, longitude: otherDelivery.delivery_location.lon }
      );

      if (distance <= maxDistance) {
        batch.push(otherDelivery);
        processed.add(otherIndex);
      }
    });

    if (batch.length > 0) {
      batches.push({
        deliveries: batch,
        totalDeliveries: batch.length,
        estimatedTime: Math.ceil(batch.length * 15), // 15 min per delivery
      });
    }
  });

  return batches;
};

/**
 * Calculate estimated time for delivery
 */
export const estimateDeliveryTime = (distance) => {
  // Simple formula: distance in km / average speed (40 km/h) * 60 min
  const timeInMinutes = Math.ceil((distance / 1000) / 40 * 60);
  return Math.max(timeInMinutes, 15); // Minimum 15 minutes
};
