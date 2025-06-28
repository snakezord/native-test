import { glslCurlNoise } from "../utils";

export const simulationFragmentShader = `

uniform sampler2D positions;
uniform float uTime;
uniform float uFrequency;
uniform float uNoiseIntensity;
uniform float uPulseAmplitude;
uniform float uTorusMode;
uniform float uTorusRadius;
uniform float uTorusSpeed;
uniform float uTorusRotation;
uniform float uTorusMinorRadius;

varying vec2 vUv;

${glslCurlNoise}

// Function to transform from sphere to torus
vec3 sphereToTorus(vec3 spherePos, float torusRadius, float tubeRadius) {
  vec3 normalized = normalize(spherePos);
  
  // Get spherical coordinates
  float theta = atan(normalized.y, normalized.x); // Angle around Y axis
  float phi = acos(normalized.z); // Angle from Z axis
  
  // Map to torus surface
  float r = torusRadius + tubeRadius * sin(phi);
  vec3 torusPos = vec3(
    r * cos(theta),
    r * sin(theta),
    tubeRadius * cos(phi)
  );
  
  return torusPos;
}

// Function to create orbital movement
vec3 getOrbitalVelocity(vec3 pos, float time) {
  vec3 normalizedPos = normalize(pos);
  
  // Create unique orbital axes based on particle position for full sphere coverage
  // This ensures each particle has a different orbital plane
  float uniqueAngle = atan(normalizedPos.y, normalizedPos.x) + normalizedPos.z * 3.14159;
  float uniqueAngle2 = dot(normalizedPos, vec3(1.0, 2.0, 3.0)) * 2.0;
  
  // Generate diverse orbital axes that span all possible orientations
  vec3 axis1 = normalize(vec3(
    sin(uniqueAngle * 2.0 + time * 0.5),
    cos(uniqueAngle * 3.0 + time * 0.3),
    sin(uniqueAngle2 + time * 0.4)
  ));
  
  vec3 axis2 = normalize(vec3(
    cos(uniqueAngle2 * 2.0 - time * 0.4),
    sin(uniqueAngle * 1.5 - time * 0.6),
    cos(uniqueAngle2 * 2.5 - time * 0.5)
  ));
  
  // Mix between pure orbital motion and position-based axes
  vec3 tangent1 = normalize(cross(normalizedPos, axis1));
  vec3 tangent2 = normalize(cross(normalizedPos, axis2));
  
  // Create a third axis that's always perpendicular to the radius
  vec3 randomTangent = normalize(vec3(normalizedPos.z, normalizedPos.x, -normalizedPos.y));
  vec3 tangent3 = normalize(cross(normalizedPos, randomTangent));
  
  // Time-varying weights for dynamic motion
  float weight1 = (sin(time * 1.7 + uniqueAngle * 4.0) + 1.0) * 0.5;
  float weight2 = (cos(time * 1.3 + uniqueAngle2 * 3.0) + 1.0) * 0.5;
  float weight3 = (sin(time * 1.1 + length(pos) * 5.0) + 1.0) * 0.5;
  
  // Normalize weights
  float totalWeight = weight1 + weight2 + weight3;
  weight1 /= totalWeight;
  weight2 /= totalWeight;
  weight3 /= totalWeight;
  
  // Combine different orbital motions
  vec3 orbitalVelocity = tangent1 * weight1 + tangent2 * weight2 + tangent3 * weight3;
  
  // Add large-scale circular motion around major axes
  float globalPhase = time + uniqueAngle * 2.0;
  vec3 globalMotion = vec3(
    sin(globalPhase) * (1.0 - abs(normalizedPos.y)),
    sin(globalPhase * 1.1) * (1.0 - abs(normalizedPos.x)),
    cos(globalPhase * 0.9) * (1.0 - abs(normalizedPos.z))
  );
  
  // Combine local and global orbital motion
  orbitalVelocity = normalize(orbitalVelocity + globalMotion * 0.5);
  
  return orbitalVelocity;
}

void main() {
  vec3 pos = texture2D(positions, vUv).rgb;
  
  // Store the original radius to maintain sphere size
  float originalRadius = length(pos);
  
  // Get orbital velocity
  vec3 velocity = getOrbitalVelocity(pos, uTime * 0.5); // Slower time for smoother orbits
  
  // Add a secondary counter-rotating orbital pattern for complexity
  vec3 secondaryVelocity = getOrbitalVelocity(pos, -uTime * 0.3);
  velocity = mix(velocity, secondaryVelocity, 0.3);
  
  // Ensure velocity is always tangent to sphere (perpendicular to radius)
  velocity = normalize(velocity - dot(velocity, normalize(pos)) * normalize(pos));
  
  // Scale velocity by noise intensity (using the same parameter for consistency)
  velocity *= uNoiseIntensity * 15.0; // Even stronger for full-sphere movement
  
  // Apply velocity to position with larger time step
  vec3 newPos = pos + velocity * 0.1; // Larger time step for more visible movement
  
  // Normalize to keep on sphere surface and restore original radius
  float sphereRadius = originalRadius;
  newPos = normalize(newPos) * sphereRadius;
  
  // Add controllable pulsing effect to radius
  float radiusPulse = 1.0 + sin(uTime * 1.5 + length(pos) * 8.0) * uPulseAmplitude;
  newPos *= radiusPulse;
  
  // Apply torus transformation if enabled
  if (uTorusMode > 0.0) {
    // Use controllable minor radius
    float tubeRadius = uTorusMinorRadius;
    
    // Transform to torus
    vec3 torusPos = sphereToTorus(newPos, uTorusRadius, tubeRadius);
    
    // Apply rotation around Z axis (torus central axis)
    float rotation = uTorusRotation;
    mat3 rotationMatrix = mat3(
      cos(rotation), -sin(rotation), 0.0,
      sin(rotation), cos(rotation), 0.0,
      0.0, 0.0, 1.0
    );
    torusPos = rotationMatrix * torusPos;
    
    // Smooth transition between sphere and torus
    newPos = mix(newPos, torusPos, uTorusMode);
  }
  
  gl_FragColor = vec4(newPos, 1.0);
}
`;
