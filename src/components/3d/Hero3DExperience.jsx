import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Hero3DExperience.jsx
 * Lightweight, mobile-responsive, procedural 3D interactive hero experience
 * for Govt. Higher Secondary School Shangus.
 *
 * Features:
 * - Knowledge Core & Orbiting Electron Rings (Science & Tech)
 * - Procedural Floating Graduation Cap (Academic Triumph)
 * - Procedural Open Book of Wisdom (Literature & Humanities)
 * - Ambient Star/Light Particle Constellation
 * - Full mobile responsiveness with dynamic FOV, scale, and touch parallax
 * - Battery-friendly: pauses rendering when off-screen via IntersectionObserver
 * - Zero-interference: pointer-events-none ensures all hero buttons remain 100% clickable
 */
export default function Hero3DExperience({ className = '' }) {
  const containerRef = useRef(null);
  const [webGlSupported, setWebGlSupported] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. WebGL Support Detection
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebGlSupported(false);
        return;
      }
    } catch (_) {
      setWebGlSupported(false);
      return;
    }

    // 2. Reduced Motion check
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 3. Setup Scene, Camera, and Renderer
    const scene = new THREE.Scene();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 450;
    const isMobile = width < 768;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = isMobile ? 6.8 : 5.2;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isMobile,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // 4. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x38bdf8, 2.0); // Cyan/Sky blue key light
    dirLight1.position.set(5, 5, 4);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xf59e0b, 1.8); // Warm Gold fill light
    dirLight2.position.set(-5, -3, 3);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0x10b981, 2.5, 10); // Emerald core glow
    pointLight.position.set(0, 0, 1);
    scene.add(pointLight);

    // 5. Procedural 3D Objects Group
    const masterGroup = new THREE.Group();
    scene.add(masterGroup);

    // Dynamic layout scaling based on viewport
    const scaleFactor = isMobile ? 0.72 : 1.0;
    masterGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);

    // ----------------------------------------------------
    // ASSET A: Central Knowledge Core & Atomic Rings
    // ----------------------------------------------------
    const coreGroup = new THREE.Group();
    // Positioned slightly right and top to frame center text
    coreGroup.position.set(isMobile ? 1.4 : 2.2, isMobile ? 0.9 : 0.6, -0.2);

    // Glowing Core Sphere
    const coreGeo = new THREE.IcosahedronGeometry(0.55, 2);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
      wireframe: true
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreGroup.add(coreMesh);

    // Inner glowing solid bead
    const innerGeo = new THREE.SphereGeometry(0.32, 16, 16);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.5
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    coreGroup.add(innerMesh);

    // Orbital Ring 1 (Torus)
    const ring1Geo = new THREE.TorusGeometry(0.9, 0.022, 12, 48);
    const ring1Mat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x059669,
      emissiveIntensity: 0.8,
      roughness: 0.3,
      metalness: 0.9
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI / 3;
    ring1.rotation.y = Math.PI / 6;
    coreGroup.add(ring1);

    // Sparkle Electron on Ring 1
    const electron1Geo = new THREE.SphereGeometry(0.06, 12, 12);
    const electron1Mat = new THREE.MeshBasicMaterial({ color: 0x6ee7b7 });
    const electron1 = new THREE.Mesh(electron1Geo, electron1Mat);
    ring1.add(electron1);

    // Orbital Ring 2 (Torus)
    const ring2Geo = new THREE.TorusGeometry(1.05, 0.02, 12, 48);
    const ring2Mat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.7,
      roughness: 0.3,
      metalness: 0.9
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = -Math.PI / 3.5;
    ring2.rotation.y = -Math.PI / 4;
    coreGroup.add(ring2);

    // Sparkle Electron on Ring 2
    const electron2Geo = new THREE.SphereGeometry(0.065, 12, 12);
    const electron2Mat = new THREE.MeshBasicMaterial({ color: 0xfde68a });
    const electron2 = new THREE.Mesh(electron2Geo, electron2Mat);
    ring2.add(electron2);

    masterGroup.add(coreGroup);

    // ----------------------------------------------------
    // ASSET B: Procedural Graduation Cap (Academic Triumph)
    // ----------------------------------------------------
    const capGroup = new THREE.Group();
    // Positioned left/upper-left to balance composition
    capGroup.position.set(isMobile ? -1.4 : -2.3, isMobile ? 0.95 : 0.7, 0.1);
    capGroup.rotation.set(0.35, -0.4, 0.2);

    // Mortarboard Diamond Top
    const boardGeo = new THREE.BoxGeometry(1.1, 0.045, 1.1);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.6
    });
    const boardMesh = new THREE.Mesh(boardGeo, capMat);
    boardMesh.rotation.y = Math.PI / 4;
    capGroup.add(boardMesh);

    // Under-cap Skullcap
    const skullGeo = new THREE.CylinderGeometry(0.35, 0.42, 0.25, 24);
    const skullMesh = new THREE.Mesh(skullGeo, capMat);
    skullMesh.position.y = -0.14;
    capGroup.add(skullMesh);

    // Gold Button on Top
    const btnGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xb45309,
      emissiveIntensity: 0.5,
      metalness: 0.9,
      roughness: 0.2
    });
    const btnMesh = new THREE.Mesh(btnGeo, goldMat);
    btnMesh.position.y = 0.035;
    capGroup.add(btnMesh);

    // Hanging Gold Tassel Ribbon & Bead
    const tasselCordGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.52, 8);
    const tasselCord = new THREE.Mesh(tasselCordGeo, goldMat);
    tasselCord.position.set(0.32, -0.16, 0.32);
    tasselCord.rotation.z = -Math.PI / 4.5;
    capGroup.add(tasselCord);

    const tasselBeadGeo = new THREE.ConeGeometry(0.045, 0.14, 12);
    const tasselBead = new THREE.Mesh(tasselBeadGeo, goldMat);
    tasselBead.position.set(0.48, -0.38, 0.48);
    tasselBead.rotation.x = Math.PI;
    capGroup.add(tasselBead);

    masterGroup.add(capGroup);

    // ----------------------------------------------------
    // ASSET C: Procedural Open Book of Wisdom (Literature & Knowledge)
    // ----------------------------------------------------
    const bookGroup = new THREE.Group();
    // Positioned lower-right/center-right
    bookGroup.position.set(isMobile ? -1.3 : -1.8, isMobile ? -1.1 : -0.85, 0.3);
    bookGroup.rotation.set(0.4, 0.5, -0.2);

    const pageMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.3,
      metalness: 0.1
    });
    const coverMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b, // Rich Crimson matching HSS Shangus crest
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.3,
      roughness: 0.5,
      metalness: 0.4
    });

    // Left Wing Cover & Pages
    const leftCoverGeo = new THREE.BoxGeometry(0.55, 0.03, 0.75);
    const leftCover = new THREE.Mesh(leftCoverGeo, coverMat);
    leftCover.position.set(-0.28, 0, 0);
    leftCover.rotation.z = Math.PI / 10;
    bookGroup.add(leftCover);

    const leftPagesGeo = new THREE.BoxGeometry(0.52, 0.07, 0.72);
    const leftPages = new THREE.Mesh(leftPagesGeo, pageMat);
    leftPages.position.set(-0.27, 0.04, 0);
    leftPages.rotation.z = Math.PI / 10;
    bookGroup.add(leftPages);

    // Right Wing Cover & Pages
    const rightCover = new THREE.Mesh(leftCoverGeo, coverMat);
    rightCover.position.set(0.28, 0, 0);
    rightCover.rotation.z = -Math.PI / 10;
    bookGroup.add(rightCover);

    const rightPages = new THREE.Mesh(leftPagesGeo, pageMat);
    rightPages.position.set(0.27, 0.04, 0);
    rightPages.rotation.z = -Math.PI / 10;
    bookGroup.add(rightPages);

    // Spine Center
    const spineGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.76, 12, 1, false, 0, Math.PI);
    const spine = new THREE.Mesh(spineGeo, coverMat);
    spine.position.set(0, -0.015, 0);
    spine.rotation.x = Math.PI / 2;
    bookGroup.add(spine);

    masterGroup.add(bookGroup);

    // ----------------------------------------------------
    // ASSET D: Floating Light Constellation / Star Dust
    // ----------------------------------------------------
    const particleCount = isMobile ? 32 : 65;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 8.5;
      particlePositions[i + 1] = (Math.random() - 0.5) * 4.5;
      particlePositions[i + 2] = (Math.random() - 0.5) * 3.5;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: isMobile ? 0.045 : 0.06,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    masterGroup.add(particleSystem);

    // ----------------------------------------------------
    // 6. Interactive Parallax Handling
    // ----------------------------------------------------
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handlePointerMove = (e) => {
      const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
      const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
      if (clientX !== undefined && clientY !== undefined) {
        targetX = (clientX / window.innerWidth - 0.5) * 0.8;
        targetY = (clientY / window.innerHeight - 0.5) * 0.6;
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    // ----------------------------------------------------
    // 7. Responsive Resizing
    // ----------------------------------------------------
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth || window.innerWidth;
      const newHeight = container.clientHeight || 450;
      const mobileNow = newWidth < 768;

      camera.aspect = newWidth / newHeight;
      camera.position.z = mobileNow ? 6.8 : 5.2;
      camera.updateProjectionMatrix();

      renderer.setSize(newWidth, newHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobileNow ? 1.5 : 2));

      const newScale = mobileNow ? 0.72 : 1.0;
      masterGroup.scale.set(newScale, newScale, newScale);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // ----------------------------------------------------
    // 8. Viewport Visibility & Battery Optimization
    // ----------------------------------------------------
    let isVisible = true;
    let animationFrameId = null;

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible && !animationFrameId) {
          lastTime = performance.now();
          renderLoop(performance.now());
        }
      },
      { threshold: 0.05 }
    );
    intersectionObserver.observe(container);

    // ----------------------------------------------------
    // 9. Animation Render Loop
    // ----------------------------------------------------
    let lastTime = performance.now();
    let electronAngle = 0;

    const renderLoop = (time) => {
      if (!isVisible) {
        animationFrameId = null;
        return;
      }

      const delta = Math.min((time - lastTime) * 0.001, 0.1);
      lastTime = time;

      const speedMultiplier = prefersReducedMotion ? 0.15 : 1.0;

      // Smooth pointer parallax with lerp damping
      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;
      masterGroup.rotation.y = mouseX * 0.6;
      masterGroup.rotation.x = -mouseY * 0.4;

      // Rotate Knowledge Core
      coreMesh.rotation.y += 0.4 * delta * speedMultiplier;
      coreMesh.rotation.x += 0.25 * delta * speedMultiplier;

      // Orbiting rings
      ring1.rotation.z += 0.8 * delta * speedMultiplier;
      ring2.rotation.z -= 0.6 * delta * speedMultiplier;

      // Orbiting electrons
      electronAngle += 1.8 * delta * speedMultiplier;
      electron1.position.set(Math.cos(electronAngle) * 0.9, Math.sin(electronAngle) * 0.9, 0);
      electron2.position.set(Math.cos(-electronAngle * 0.8) * 1.05, Math.sin(-electronAngle * 0.8) * 1.05, 0);

      // Graduation Cap Floating Bobbing & Tilt
      const capBob = Math.sin(time * 0.0015 * speedMultiplier) * 0.12;
      capGroup.position.y = (isMobile ? 0.95 : 0.7) + capBob;
      capGroup.rotation.y = -0.4 + Math.cos(time * 0.001 * speedMultiplier) * 0.15;

      // Open Book Floating Bobbing & Rotation
      const bookBob = Math.cos(time * 0.0014 * speedMultiplier) * 0.1;
      bookGroup.position.y = (isMobile ? -1.1 : -0.85) + bookBob;
      bookGroup.rotation.y = 0.5 + Math.sin(time * 0.0012 * speedMultiplier) * 0.18;

      // Ambient Particles Slow Drift
      particleSystem.rotation.y += 0.06 * delta * speedMultiplier;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop(performance.now());

    // ----------------------------------------------------
    // 10. Comprehensive Cleanup on Unmount
    // ----------------------------------------------------
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      window.removeEventListener('pointermove', handlePointerMove);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();

      // Dispose Three.js objects
      scene.traverse((child) => {
        if (child.isMesh || child.isPoints) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (!webGlSupported) return null;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`hero-3d-canvas-container absolute inset-0 w-full h-full pointer-events-none z-10 overflow-hidden ${className}`}
      style={{ opacity: 0.92 }}
    />
  );
}
