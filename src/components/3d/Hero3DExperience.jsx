import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Hero3DExperience.jsx
 * Lightweight, procedural, ultra-premium 3D hero experience for
 * Govt. Higher Secondary School Shangus.
 *
 * Golden Triangle Composition:
 * - 🌐 Celestial Armillary Globe: Centered ABOVE "nurturing minds, shaping futures"
 *     -> Actively tracks cursor/touch across the hero section with gyroscopic physics.
 * - 🎓 Academic Mortarboard Cap: Positioned BELOW "futures" on the right
 *     -> Reacts with a celebratory graduation hat toss and tassel spin when hovering "Learn More".
 * - 📖 Open Book of Wisdom: Positioned in the LOWER-LEFT
 *     -> Reacts by fanning pages open and glowing warmly when hovering "Admissions Open 2026".
 * - ✨ Stardust Constellation: Subtle gold & cyan ambient particles.
 *
 * Fully mobile responsive, zero heavy external asset downloads, 60fps,
 * zero interference with hero button clicks (pointer-events: none).
 */
export default function Hero3DExperience({ className = '', hoveredAction = null }) {
  const containerRef = useRef(null);
  const [webGlSupported, setWebGlSupported] = useState(true);
  const hoveredActionRef = useRef(hoveredAction);

  // Keep ref synchronized so the render loop always accesses the latest hover state without recreation
  useEffect(() => {
    hoveredActionRef.current = hoveredAction;
  }, [hoveredAction]);

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

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 2. Setup Scene, Camera, and Renderer
    const scene = new THREE.Scene();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 450;
    const isMobile = width < 768;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = isMobile ? 6.6 : 5.2;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isMobile,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // 3. Studio Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(ambientLight);

    // Key Light: Cyan / Sky Blue
    const keyLight = new THREE.DirectionalLight(0x38bdf8, 2.4);
    keyLight.position.set(5, 6, 4);
    scene.add(keyLight);

    // Fill Light: Imperial Warm Gold
    const fillLight = new THREE.DirectionalLight(0xf59e0b, 2.0);
    fillLight.position.set(-5, -3, 3);
    scene.add(fillLight);

    // Core Illumination Point Light
    const coreLight = new THREE.PointLight(0x0ea5e9, 2.2, 8);
    coreLight.position.set(0, 1.35, 0.5);
    scene.add(coreLight);

    // Book Knowledge Glow Point Light
    const bookLight = new THREE.PointLight(0xfef08a, 0, 4);
    bookLight.position.set(-2.05, -0.6, 0.6);
    scene.add(bookLight);

    // Master Group
    const masterGroup = new THREE.Group();
    scene.add(masterGroup);

    // Dynamic Scale Factor
    const baseScale = isMobile ? 0.72 : 1.0;
    masterGroup.scale.set(baseScale, baseScale, baseScale);

    // =========================================================================
    // ASSET 1: CELESTIAL ARMILLARY GLOBE OF KNOWLEDGE
    // Positioned ABOVE "nurturing minds, shaping futures"
    // =========================================================================
    const globeAnchor = new THREE.Group();
    const globeDefaultPos = {
      x: 0,
      y: isMobile ? 1.08 : 1.35,
      z: -0.1
    };
    globeAnchor.position.set(globeDefaultPos.x, globeDefaultPos.y, globeDefaultPos.z);
    globeAnchor.scale.setScalar(isMobile ? 0.62 : 0.82);

    const globeInteractiveGroup = new THREE.Group();
    globeAnchor.add(globeInteractiveGroup);

    // 1A. Inner Nucleus: Multi-faceted Crystal Core
    const crystalGeo = new THREE.IcosahedronGeometry(0.24, 1);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.95
    });
    const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
    globeInteractiveGroup.add(crystalMesh);

    // 1B. Inner Glowing Orb
    const innerOrbGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const innerOrbMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    const innerOrb = new THREE.Mesh(innerOrbGeo, innerOrbMat);
    globeInteractiveGroup.add(innerOrb);

    // 1C. Translucent Latitude/Longitude Grid Sphere
    const gridSphereGeo = new THREE.SphereGeometry(0.55, 20, 12);
    const gridSphereMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.4,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
      roughness: 0.2,
      metalness: 0.8
    });
    const gridSphere = new THREE.Mesh(gridSphereGeo, gridSphereMat);
    globeInteractiveGroup.add(gridSphere);

    // 1D. Armillary Rings: Polished Imperial Gold & Cyan Gimbal
    const goldRingMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0x78350f,
      emissiveIntensity: 0.45,
      metalness: 0.95,
      roughness: 0.15
    });

    // Meridian Ring (Vertical)
    const meridianGeo = new THREE.TorusGeometry(0.62, 0.016, 16, 52);
    const meridianRing = new THREE.Mesh(meridianGeo, goldRingMat);
    globeInteractiveGroup.add(meridianRing);

    // Equator Ring (Horizontal)
    const equatorGeo = new THREE.TorusGeometry(0.62, 0.016, 16, 52);
    const equatorRing = new THREE.Mesh(equatorGeo, goldRingMat);
    equatorRing.rotation.x = Math.PI / 2;
    globeInteractiveGroup.add(equatorRing);

    // Outer Celestial Gyroscope Gimbal (Electric Cyan)
    const cyanGimbalMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0e7490,
      emissiveIntensity: 0.5,
      metalness: 0.92,
      roughness: 0.2
    });
    const gimbalGeo = new THREE.TorusGeometry(0.78, 0.018, 16, 52);
    const gimbalRing = new THREE.Mesh(gimbalGeo, cyanGimbalMat);
    gimbalRing.rotation.x = Math.PI / 4;
    gimbalRing.rotation.y = Math.PI / 6;
    globeInteractiveGroup.add(gimbalRing);

    // 1E. Orbiting Quantum Electrons with Trails
    const orbit1Geo = new THREE.TorusGeometry(0.92, 0.012, 12, 48);
    const orbit1Mat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x047857,
      emissiveIntensity: 0.6,
      metalness: 0.85,
      roughness: 0.3
    });
    const orbit1 = new THREE.Mesh(orbit1Geo, orbit1Mat);
    orbit1.rotation.x = -Math.PI / 3;
    globeInteractiveGroup.add(orbit1);

    const electron1Geo = new THREE.SphereGeometry(0.055, 12, 12);
    const electron1Mat = new THREE.MeshBasicMaterial({ color: 0x6ee7b7 });
    const electron1 = new THREE.Mesh(electron1Geo, electron1Mat);
    orbit1.add(electron1);

    const orbit2Geo = new THREE.TorusGeometry(1.05, 0.012, 12, 48);
    const orbit2Mat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xb45309,
      emissiveIntensity: 0.6,
      metalness: 0.85,
      roughness: 0.3
    });
    const orbit2 = new THREE.Mesh(orbit2Geo, orbit2Mat);
    orbit2.rotation.x = Math.PI / 3.2;
    orbit2.rotation.y = -Math.PI / 4.5;
    globeInteractiveGroup.add(orbit2);

    const electron2Geo = new THREE.SphereGeometry(0.06, 12, 12);
    const electron2Mat = new THREE.MeshBasicMaterial({ color: 0xfde68a });
    const electron2 = new THREE.Mesh(electron2Geo, electron2Mat);
    orbit2.add(electron2);

    masterGroup.add(globeAnchor);

    // =========================================================================
    // ASSET 2: ACADEMIC MORTARBOARD GRADUATION CAP
    // Positioned BELOW "futures" on the right
    // =========================================================================
    const capAnchor = new THREE.Group();
    const capDefaultPos = {
      x: isMobile ? 1.15 : 2.05,
      y: isMobile ? -0.85 : -0.58,
      z: isMobile ? 0.15 : 0.22
    };
    capAnchor.position.set(capDefaultPos.x, capDefaultPos.y, capDefaultPos.z);
    capAnchor.scale.setScalar(isMobile ? 0.62 : 0.82);

    const capMeshGroup = new THREE.Group();
    capMeshGroup.rotation.set(0.35, -0.4, 0.18);
    capAnchor.add(capMeshGroup);

    // 2A. Satin Midnight Silk Mortarboard Diamond
    const boardGeo = new THREE.BoxGeometry(1.05, 0.04, 1.05);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.35,
      metalness: 0.35
    });
    const boardMesh = new THREE.Mesh(boardGeo, capMat);
    boardMesh.rotation.y = Math.PI / 4;
    capMeshGroup.add(boardMesh);

    // 2B. 24K Gold Filigree Edge Lining
    const edgeTrimGeo = new THREE.BoxGeometry(1.06, 0.008, 1.06);
    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xb45309,
      emissiveIntensity: 0.55,
      metalness: 0.95,
      roughness: 0.15
    });
    const edgeTrimMesh = new THREE.Mesh(edgeTrimGeo, goldTrimMat);
    edgeTrimMesh.rotation.y = Math.PI / 4;
    capMeshGroup.add(edgeTrimMesh);

    // 2C. Tapered Skullcap Base
    const skullGeo = new THREE.CylinderGeometry(0.34, 0.44, 0.24, 28);
    const skullMesh = new THREE.Mesh(skullGeo, capMat);
    skullMesh.position.y = -0.13;
    capMeshGroup.add(skullMesh);

    // 2D. Gold Crown Button
    const capBtnGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.035, 20);
    const capBtnMesh = new THREE.Mesh(capBtnGeo, goldTrimMat);
    capBtnMesh.position.y = 0.035;
    capMeshGroup.add(capBtnMesh);

    // 2E. Braided Silk Tassel with Physics Anchor
    const tasselGroup = new THREE.Group();
    tasselGroup.position.set(0, 0.035, 0);

    const cordGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.55, 10);
    const cordMesh = new THREE.Mesh(cordGeo, goldTrimMat);
    cordMesh.position.set(0.34, -0.16, 0.34);
    cordMesh.rotation.z = -Math.PI / 4.2;
    cordMesh.rotation.y = Math.PI / 4;
    tasselGroup.add(cordMesh);

    // Flared Silk Fringe Tassel Cone
    const fringeGeo = new THREE.ConeGeometry(0.052, 0.18, 16);
    const fringeMesh = new THREE.Mesh(fringeGeo, goldTrimMat);
    fringeMesh.position.set(0.52, -0.42, 0.52);
    fringeMesh.rotation.x = Math.PI;
    tasselGroup.add(fringeMesh);

    capMeshGroup.add(tasselGroup);
    masterGroup.add(capAnchor);

    // =========================================================================
    // ASSET 3: OPEN BOOK OF WISDOM
    // Positioned in the LOWER-LEFT
    // =========================================================================
    const bookAnchor = new THREE.Group();
    const bookDefaultPos = {
      x: isMobile ? -1.15 : -2.05,
      y: isMobile ? -0.98 : -0.78,
      z: isMobile ? 0.18 : 0.26
    };
    bookAnchor.position.set(bookDefaultPos.x, bookDefaultPos.y, bookDefaultPos.z);
    bookAnchor.scale.setScalar(isMobile ? 0.62 : 0.84);

    const bookMeshGroup = new THREE.Group();
    bookMeshGroup.rotation.set(0.42, 0.52, -0.22);
    bookAnchor.add(bookMeshGroup);

    // Materials: Moroccan Crimson Leather & Antique Parchment
    const coverMat = new THREE.MeshStandardMaterial({
      color: 0x881337, // Royal Burgundy
      emissive: 0x4c0519,
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.25
    });

    const pageMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb, // Warm Ivory Parchment
      emissive: 0xfef08a,
      emissiveIntensity: 0.08,
      roughness: 0.35,
      metalness: 0.08
    });

    const goldGiltMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0x92400e,
      emissiveIntensity: 0.45,
      metalness: 0.9,
      roughness: 0.2
    });

    // Left Wing (Cover + Layered Pages)
    const leftWingGroup = new THREE.Group();
    const coverWingGeo = new THREE.BoxGeometry(0.58, 0.03, 0.78);
    const leftCover = new THREE.Mesh(coverWingGeo, coverMat);
    leftCover.position.set(-0.29, 0, 0);
    leftWingGroup.add(leftCover);

    const pageStackGeo = new THREE.BoxGeometry(0.54, 0.065, 0.74);
    const leftPages = new THREE.Mesh(pageStackGeo, pageMat);
    leftPages.position.set(-0.28, 0.04, 0);
    leftWingGroup.add(leftPages);

    // Gold gilt trim on page edges
    const giltEdgeGeo = new THREE.BoxGeometry(0.015, 0.065, 0.74);
    const leftGilt = new THREE.Mesh(giltEdgeGeo, goldGiltMat);
    leftGilt.position.set(-0.545, 0.04, 0);
    leftWingGroup.add(leftGilt);

    leftWingGroup.rotation.z = Math.PI / 10;
    bookMeshGroup.add(leftWingGroup);

    // Right Wing (Cover + Layered Pages)
    const rightWingGroup = new THREE.Group();
    const rightCover = new THREE.Mesh(coverWingGeo, coverMat);
    rightCover.position.set(0.29, 0, 0);
    rightWingGroup.add(rightCover);

    const rightPages = new THREE.Mesh(pageStackGeo, pageMat);
    rightPages.position.set(0.28, 0.04, 0);
    rightWingGroup.add(rightPages);

    const rightGilt = new THREE.Mesh(giltEdgeGeo, goldGiltMat);
    rightGilt.position.set(0.545, 0.04, 0);
    rightWingGroup.add(rightGilt);

    rightWingGroup.rotation.z = -Math.PI / 10;
    bookMeshGroup.add(rightWingGroup);

    // Curved Spine Center
    const spineGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.8, 16, 1, false, 0, Math.PI);
    const spine = new THREE.Mesh(spineGeo, coverMat);
    spine.position.set(0, -0.015, 0);
    spine.rotation.x = Math.PI / 2;
    bookMeshGroup.add(spine);

    // Silk Bookmark Ribbon trailing from spine
    const ribbonGeo = new THREE.BoxGeometry(0.05, 0.008, 0.45);
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xb45309,
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.25
    });
    const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbon.position.set(0.08, 0.07, 0.22);
    ribbon.rotation.set(-0.25, 0.15, -0.1);
    bookMeshGroup.add(ribbon);

    masterGroup.add(bookAnchor);

    // =========================================================================
    // ASSET 4: AMBIENT CELESTIAL STARDUST PARTICLES
    // =========================================================================
    const particleCount = isMobile ? 32 : 55;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 8.5;
      particlePositions[i + 1] = (Math.random() - 0.5) * 4.8;
      particlePositions[i + 2] = (Math.random() - 0.5) * 3.5;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: isMobile ? 0.045 : 0.065,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    masterGroup.add(particleSystem);

    // =========================================================================
    // 5. INTERACTIVE MOUSE TRACKING ON HERO IMAGE
    // The globe dynamically tracks pointer position across the hero container
    // =========================================================================
    let mouseNormX = 0; // -0.5 to 0.5
    let mouseNormY = 0; // -0.5 to 0.5
    let targetMouseX = 0;
    let targetMouseY = 0;

    const heroContainerEl = container.closest('.hero-container') || container.parentElement || window;

    const handlePointerMove = (e) => {
      const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
      const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
      if (clientX === undefined || clientY === undefined) return;

      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        targetMouseX = (clientX - rect.left) / rect.width - 0.5;
        targetMouseY = (clientY - rect.top) / rect.height - 0.5;
      } else {
        targetMouseX = clientX / window.innerWidth - 0.5;
        targetMouseY = clientY / window.innerHeight - 0.5;
      }
    };

    const handlePointerLeave = () => {
      targetMouseX = 0;
      targetMouseY = 0;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    if (heroContainerEl && heroContainerEl.addEventListener) {
      heroContainerEl.addEventListener('pointerleave', handlePointerLeave, { passive: true });
    }

    // =========================================================================
    // 6. RESPONSIVE RESIZING
    // =========================================================================
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth || window.innerWidth;
      const newHeight = container.clientHeight || 450;
      const mobileNow = newWidth < 768;

      camera.aspect = newWidth / newHeight;
      camera.position.z = mobileNow ? 6.6 : 5.2;
      camera.updateProjectionMatrix();

      renderer.setSize(newWidth, newHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobileNow ? 1.5 : 2));

      const newBaseScale = mobileNow ? 0.72 : 1.0;
      masterGroup.scale.set(newBaseScale, newBaseScale, newBaseScale);

      // Reposition coordinates according to viewport
      globeDefaultPos.y = mobileNow ? 1.08 : 1.35;
      globeAnchor.scale.setScalar(mobileNow ? 0.62 : 0.82);

      capDefaultPos.x = mobileNow ? 1.15 : 2.05;
      capDefaultPos.y = mobileNow ? -0.85 : -0.58;
      capDefaultPos.z = mobileNow ? 0.15 : 0.22;
      capAnchor.scale.setScalar(mobileNow ? 0.62 : 0.82);

      bookDefaultPos.x = mobileNow ? -1.15 : -2.05;
      bookDefaultPos.y = mobileNow ? -0.98 : -0.78;
      bookDefaultPos.z = mobileNow ? 0.18 : 0.26;
      bookAnchor.scale.setScalar(mobileNow ? 0.62 : 0.84);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // =========================================================================
    // 7. BATTERY-FRIENDLY INTERSECTION OBSERVER
    // =========================================================================
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

    // =========================================================================
    // 8. ANIMATION & MICRO-INTERACTION RENDER LOOP
    // =========================================================================
    let lastTime = performance.now();
    let electronAngle = 0;
    let capSpinOffset = 0;
    let capLiftProgress = 0; // 0 (idle) to 1 (celebration toss)
    let bookLiftProgress = 0; // 0 (idle) to 1 (open invitation)

    const renderLoop = (time) => {
      if (!isVisible) {
        animationFrameId = null;
        return;
      }

      const delta = Math.min((time - lastTime) * 0.001, 0.1);
      lastTime = time;

      const speedMult = prefersReducedMotion ? 0.15 : 1.0;

      // Smooth pointer tracking lerp
      mouseNormX += (targetMouseX - mouseNormX) * 0.06;
      mouseNormY += (targetMouseY - mouseNormY) * 0.06;

      // Master subtle depth parallax
      masterGroup.rotation.y = mouseNormX * 0.35;
      masterGroup.rotation.x = -mouseNormY * 0.25;

      // -----------------------------------------------------------------------
      // 8A. GLOBE: Tracks mouse on hero image with gyroscopic orientation
      // -----------------------------------------------------------------------
      // Natural idle rotation
      crystalMesh.rotation.y += 0.45 * delta * speedMult;
      crystalMesh.rotation.x += 0.3 * delta * speedMult;
      gridSphere.rotation.y += 0.2 * delta * speedMult;

      meridianRing.rotation.y += 0.3 * delta * speedMult;
      gimbalRing.rotation.z += 0.4 * delta * speedMult;

      // Direct Mouse Tracking: Globe faces towards cursor
      const targetGlobeRotY = mouseNormX * 2.2;
      const targetGlobeRotX = -mouseNormY * 1.6;
      globeInteractiveGroup.rotation.y += (targetGlobeRotY - globeInteractiveGroup.rotation.y) * 0.08;
      globeInteractiveGroup.rotation.x += (targetGlobeRotX - globeInteractiveGroup.rotation.x) * 0.08;

      // Electrons orbit faster when mouse is active
      const mouseSpeedBoost = 1.0 + Math.hypot(mouseNormX, mouseNormY) * 2.5;
      electronAngle += 1.8 * delta * speedMult * mouseSpeedBoost;
      electron1.position.set(Math.cos(electronAngle) * 0.92, Math.sin(electronAngle) * 0.92, 0);
      electron2.position.set(Math.cos(-electronAngle * 0.85) * 1.05, Math.sin(-electronAngle * 0.85) * 1.05, 0);

      // Globe Gentle Bobbing
      const globeBob = Math.sin(time * 0.0016 * speedMult) * 0.06;
      globeAnchor.position.y = globeDefaultPos.y + globeBob;

      // -----------------------------------------------------------------------
      // 8B. GRADUATION CAP: Responds when hovering "Learn More"
      // -----------------------------------------------------------------------
      const isLearnHovered = hoveredActionRef.current === 'learn';
      const targetCapLift = isLearnHovered ? 1 : 0;
      capLiftProgress += (targetCapLift - capLiftProgress) * 0.1;

      // Celebratory spin when hovered
      if (isLearnHovered) {
        capSpinOffset += delta * 6.5 * speedMult;
      } else {
        // Return smoothly towards 0
        capSpinOffset += (0 - (capSpinOffset % (Math.PI * 2))) * 0.08;
      }

      const capIdleBob = Math.sin(time * 0.0018 * speedMult) * 0.08;
      capAnchor.position.y = capDefaultPos.y + capIdleBob + (capLiftProgress * 0.35); // Hat toss lift
      capAnchor.position.x = capDefaultPos.x + (capLiftProgress * 0.08);

      capMeshGroup.rotation.y = -0.4 + Math.cos(time * 0.001 * speedMult) * 0.12 + capSpinOffset;
      capMeshGroup.rotation.x = 0.35 - (capLiftProgress * 0.2); // Flips back slightly on toss

      // Tassel wave physics (centrifugal motion when tossed/spun)
      const tasselWave = Math.sin(time * (isLearnHovered ? 0.015 : 0.0025) * speedMult) * (isLearnHovered ? 0.35 : 0.1);
      tasselGroup.rotation.z = tasselWave;

      // -----------------------------------------------------------------------
      // 8C. OPEN BOOK: Responds when hovering "Admissions Open 2026"
      // -----------------------------------------------------------------------
      const isAdmissionsHovered = hoveredActionRef.current === 'admissions';
      const targetBookLift = isAdmissionsHovered ? 1 : 0;
      bookLiftProgress += (targetBookLift - bookLiftProgress) * 0.08;

      const bookIdleBob = Math.cos(time * 0.0015 * speedMult) * 0.07;
      bookAnchor.position.y = bookDefaultPos.y + bookIdleBob + (bookLiftProgress * 0.24); // Lift forward
      bookAnchor.position.z = bookDefaultPos.z + (bookLiftProgress * 0.18);

      // Pages fan open wider when admissions button is hovered!
      const baseWingAngle = Math.PI / 10; // ~18 degrees
      const openWingAngle = Math.PI / 5.2; // ~35 degrees
      const currentWingAngle = baseWingAngle + (openWingAngle - baseWingAngle) * bookLiftProgress;

      leftWingGroup.rotation.z = currentWingAngle;
      rightWingGroup.rotation.z = -currentWingAngle;

      // Glow light intensification inside pages on admissions hover
      bookLight.intensity = bookLiftProgress * 2.4;
      pageMat.emissiveIntensity = 0.08 + (bookLiftProgress * 0.38);

      // Bookmark ribbon gentle wave
      ribbon.rotation.z = -0.1 + Math.sin(time * 0.002 * speedMult) * (0.05 + bookLiftProgress * 0.12);

      // -----------------------------------------------------------------------
      // 8D. STARDUST: Ambient drift
      // -----------------------------------------------------------------------
      particleSystem.rotation.y += 0.05 * delta * speedMult;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop(performance.now());

    // -------------------------------------------------------------------------
    // 9. CLEANUP ON UNMOUNT
    // -------------------------------------------------------------------------
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      window.removeEventListener('pointermove', handlePointerMove);
      if (heroContainerEl && heroContainerEl.removeEventListener) {
        heroContainerEl.removeEventListener('pointerleave', handlePointerLeave);
      }
      resizeObserver.disconnect();
      intersectionObserver.disconnect();

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
      style={{ opacity: 0.94 }}
    />
  );
}
