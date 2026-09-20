import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Hero3DExperience.jsx
 * Lightweight, procedural, ultra-premium 3D hero experience for
 * Govt. Higher Secondary School Shangus.
 *
 * Core Features:
 * 1. ⚛️ Scientifically Accurate Carbon Atom Orbitals (Z = 6):
 *    - Central Nucleus: Official circular HSS Shangus logo seal enclosed in a 24K gold bezel
 *      with a glowing nuclear energy envelope.
 *    - Inner Shell (1s²): 2 high-speed Pauli-paired core electrons on a tight orbital ring.
 *    - Outer Valence Shell (2s² 2p² / sp³): 4 valence electrons orbiting in 4 spatially oriented
 *      quantum orbital planes (tetrahedral / orthogonal angles).
 *    - Total 6 electrons exactly matching the Carbon atom.
 *    - Gyroscopically follows mouse location and tilts with quantum relativistic precession.
 * 2. 📖 Open Book of Wisdom (Strictly on Left of "Admissions Open 2026"):
 *    - Positioned with generous breathing room to the left of the button.
 *    - When Admissions Open is hovered: cascading fluttering/slipping pages arching upward
 *      without flopping all the way to the left side!
 * 3. 🧪 Scientific Laboratory Apparatus (Erlenmeyer Flask of Discovery, Strictly on Right of "Learn More"):
 *    - Positioned with generous breathing room to the right of the button.
 *    - Universally applicable to all students across STEM, Chemistry, Biology, Physics, & General Sciences.
 *    - Borosilicate glass with volumetric graduations, glass stirring rod, glowing cyan discovery elixir, and rising effervescent bubbles.
 *    - Synchronized: when Admissions Open is hovered, elevates (+0.18Y), tilts, liquid radiates discovery glow, and bubbles effervesce faster.
 * 4. "Learn More" is completely detached from 3D motion, maintaining a clean secondary link.
 */
export default function Hero3DExperience({ className = '', hoveredAction = null }) {
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [webGlSupported, setWebGlSupported] = useState(true);
  const [pinnedTooltip, setPinnedTooltip] = useState(false);
  const pinnedTooltipRef = useRef(false);
  const hoveredActionRef = useRef(hoveredAction);

  useEffect(() => {
    hoveredActionRef.current = hoveredAction;
  }, [hoveredAction]);

  useEffect(() => {
    pinnedTooltipRef.current = pinnedTooltip;
  }, [pinnedTooltip]);

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
    camera.position.z = isMobile ? 6.5 : 5.2;

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
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
    scene.add(ambientLight);

    // Key Light: Electric Cyan
    const keyLight = new THREE.DirectionalLight(0x38bdf8, 2.2);
    keyLight.position.set(5, 6, 4);
    scene.add(keyLight);

    // Fill Light: Imperial Warm Gold
    const fillLight = new THREE.DirectionalLight(0xf59e0b, 1.8);
    fillLight.position.set(-5, -3, 3);
    scene.add(fillLight);

    // Dynamic Book Pages Glow Light
    const bookLight = new THREE.PointLight(0xfef08a, 0, 3.5);
    bookLight.position.set(-2.2, -0.35, 0.5);
    scene.add(bookLight);

    // Master Group
    const masterGroup = new THREE.Group();
    scene.add(masterGroup);

    const baseScale = isMobile ? 0.55 : 0.72;
    masterGroup.scale.set(baseScale, baseScale, baseScale);

    // =========================================================================
    // ASSET 1: ACCURATE CARBON ATOM ORBITALS (Z = 6 ELECTRONS)
    // Centered above the motto and actively glides to follow mouse location!
    // =========================================================================
    const atomAnchor = new THREE.Group();
    const atomHomePos = {
      x: 0,
      y: isMobile ? 1.00 : 1.22,
      z: -0.1
    };
    atomAnchor.position.set(atomHomePos.x, atomHomePos.y, atomHomePos.z);
    atomAnchor.scale.setScalar(isMobile ? 0.44 : 0.58);

    const atomInteractiveGroup = new THREE.Group();
    atomAnchor.add(atomInteractiveGroup);

    // 1A. Load Official Circular HSS Shangus Logo for Nucleus Center
    const textureLoader = new THREE.TextureLoader();
    const logoTexture = textureLoader.load('/logo.png');
    logoTexture.colorSpace = THREE.SRGBColorSpace;

    const logoMat = new THREE.MeshStandardMaterial({
      map: logoTexture,
      transparent: true,
      roughness: 0.25,
      metalness: 0.15,
      emissive: 0xffffff,
      emissiveIntensity: 0.14,
      side: THREE.DoubleSide
    });

    // Circular Disc Medallion (Front & Back Logo)
    const medalGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.02, 32);
    const medalMesh = new THREE.Mesh(medalGeo, [
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.95, roughness: 0.15 }),
      logoMat,
      logoMat
    ]);
    medalMesh.rotation.x = Math.PI / 2;
    atomInteractiveGroup.add(medalMesh);

    // 24K Gold Bezel Rim around the logo medal
    const goldBezelMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0x78350f,
      emissiveIntensity: 0.45,
      metalness: 0.95,
      roughness: 0.15
    });
    const bezelGeo = new THREE.TorusGeometry(0.25, 0.016, 16, 48);
    const bezelMesh = new THREE.Mesh(bezelGeo, goldBezelMat);
    atomInteractiveGroup.add(bezelMesh);

    // Glowing Nuclear Shell Envelope
    const nucleusGeo = new THREE.SphereGeometry(0.32, 20, 16);
    const nucleusMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.22,
      roughness: 0.2,
      metalness: 0.8
    });
    const nucleusShell = new THREE.Mesh(nucleusGeo, nucleusMat);
    atomInteractiveGroup.add(nucleusShell);

    // -------------------------------------------------------------------------
    // 1B. CARBON INNER SHELL (1s² ORBITAL) — EXACTLY 2 ELECTRONS
    // Pauli-paired core electrons diametrically opposite on n=1 ground state orbital
    // -------------------------------------------------------------------------
    const innerRingMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.55,
      metalness: 0.9,
      roughness: 0.2
    });
    const innerRingRadius = 0.50;
    const innerRingGeo = new THREE.TorusGeometry(innerRingRadius, 0.010, 12, 52);
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = Math.PI / 3.5;
    innerRing.rotation.y = Math.PI / 6;
    atomInteractiveGroup.add(innerRing);

    // Electron 1 (Inner 1s electron, paired)
    const electronInnerMat1 = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const electronCoreGeo = new THREE.SphereGeometry(0.046, 12, 12);
    const electron1 = new THREE.Mesh(electronCoreGeo, electronInnerMat1);
    innerRing.add(electron1);

    // Electron 2 (Inner 1s electron, opposite phase / Pauli paired)
    const electronInnerMat2 = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
    const electron2 = new THREE.Mesh(electronCoreGeo, electronInnerMat2);
    innerRing.add(electron2);

    // -------------------------------------------------------------------------
    // 1C. CARBON OUTER VALENCE SHELL (2s² 2p² / sp³ ORBITALS) — EXACTLY 4 ELECTRONS
    // 4 degenerate sp³ quantum orbital planes oriented in authentic tetrahedral geometry (109.47°)
    // Normals point along vertices of regular tetrahedron: (+1,+1,+1), (-1,-1,+1), (-1,+1,-1), (+1,-1,-1)
    // -------------------------------------------------------------------------
    const valenceRadius = 0.94;
    const valenceRingGeo = new THREE.TorusGeometry(valenceRadius, 0.009, 12, 56);

    const valenceRingMat1 = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xb45309,
      emissiveIntensity: 0.5,
      metalness: 0.92,
      roughness: 0.2
    });
    const valenceRingMat2 = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x047857,
      emissiveIntensity: 0.5,
      metalness: 0.92,
      roughness: 0.2
    });
    const valenceRingMat3 = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0e7490,
      emissiveIntensity: 0.5,
      metalness: 0.92,
      roughness: 0.2
    });
    const valenceRingMat4 = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.45,
      metalness: 0.92,
      roughness: 0.2
    });

    const defaultNormalZ = new THREE.Vector3(0, 0, 1);
    const electronValenceGeo = new THREE.SphereGeometry(0.048, 12, 12);

    // Orbital Ring 1: (+1, +1, +1)
    const ringV1 = new THREE.Mesh(valenceRingGeo, valenceRingMat1);
    ringV1.quaternion.setFromUnitVectors(defaultNormalZ, new THREE.Vector3(1, 1, 1).normalize());
    atomInteractiveGroup.add(ringV1);

    // Electron 3 (Valence electron 1)
    const electronValenceMat1 = new THREE.MeshBasicMaterial({ color: 0xfde68a });
    const electron3 = new THREE.Mesh(electronValenceGeo, electronValenceMat1);
    ringV1.add(electron3);

    // Orbital Ring 2: (-1, -1, +1)
    const ringV2 = new THREE.Mesh(valenceRingGeo, valenceRingMat2);
    ringV2.quaternion.setFromUnitVectors(defaultNormalZ, new THREE.Vector3(-1, -1, 1).normalize());
    atomInteractiveGroup.add(ringV2);

    // Electron 4 (Valence electron 2)
    const electronValenceMat2 = new THREE.MeshBasicMaterial({ color: 0x6ee7b7 });
    const electron4 = new THREE.Mesh(electronValenceGeo, electronValenceMat2);
    ringV2.add(electron4);

    // Orbital Ring 3: (-1, +1, -1)
    const ringV3 = new THREE.Mesh(valenceRingGeo, valenceRingMat3);
    ringV3.quaternion.setFromUnitVectors(defaultNormalZ, new THREE.Vector3(-1, 1, -1).normalize());
    atomInteractiveGroup.add(ringV3);

    // Electron 5 (Valence electron 3)
    const electronValenceMat3 = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
    const electron5 = new THREE.Mesh(electronValenceGeo, electronValenceMat3);
    ringV3.add(electron5);

    // Orbital Ring 4: (+1, -1, -1)
    const ringV4 = new THREE.Mesh(valenceRingGeo, valenceRingMat4);
    ringV4.quaternion.setFromUnitVectors(defaultNormalZ, new THREE.Vector3(1, -1, -1).normalize());
    atomInteractiveGroup.add(ringV4);

    // Electron 6 (Valence electron 4)
    const electronValenceMat4 = new THREE.MeshBasicMaterial({ color: 0xd8b4fe });
    const electron6 = new THREE.Mesh(electronValenceGeo, electronValenceMat4);
    ringV4.add(electron6);

    masterGroup.add(atomAnchor);

    // =========================================================================
    // ASSET 2: OPEN BOOK OF WISDOM (STRICTLY ON LEFT OF "ADMISSIONS OPEN 2026")
    // =========================================================================
    const bookAnchor = new THREE.Group();
    const bookHomePos = {
      x: isMobile ? -1.60 : -2.35,
      y: isMobile ? -0.42 : -0.38,
      z: isMobile ? 0.18 : 0.24
    };
    bookAnchor.position.set(bookHomePos.x, bookHomePos.y, bookHomePos.z);
    bookAnchor.scale.setScalar(isMobile ? 0.34 : 0.44);

    const bookMeshGroup = new THREE.Group();
    bookMeshGroup.rotation.set(0.38, 0.42, -0.18);
    bookAnchor.add(bookMeshGroup);

    // Materials: Moroccan Crimson Leather & Antique Parchment
    const coverMat = new THREE.MeshStandardMaterial({
      color: 0x881337,
      emissive: 0x4c0519,
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.25
    });

    const staticPageMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xfef08a,
      emissiveIntensity: 0.08,
      roughness: 0.35,
      metalness: 0.08
    });

    const activeFlippingPageMat = new THREE.MeshStandardMaterial({
      color: 0xfffef5,
      emissive: 0xfef08a,
      emissiveIntensity: 0.18,
      roughness: 0.3,
      metalness: 0.06,
      side: THREE.DoubleSide
    });

    const goldGiltMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0x92400e,
      emissiveIntensity: 0.45,
      metalness: 0.9,
      roughness: 0.2
    });

    // Base Covers
    const coverWingGeo = new THREE.BoxGeometry(0.58, 0.03, 0.78);
    const leftCover = new THREE.Mesh(coverWingGeo, coverMat);
    leftCover.position.set(-0.29, 0, 0);
    leftCover.rotation.z = Math.PI / 10;
    bookMeshGroup.add(leftCover);

    const rightCover = new THREE.Mesh(coverWingGeo, coverMat);
    rightCover.position.set(0.29, 0, 0);
    rightCover.rotation.z = -Math.PI / 10;
    bookMeshGroup.add(rightCover);

    // Base Stack of Bound Pages
    const basePagesGeo = new THREE.BoxGeometry(0.54, 0.055, 0.74);
    const leftBasePages = new THREE.Mesh(basePagesGeo, staticPageMat);
    leftBasePages.position.set(-0.28, 0.035, 0);
    leftBasePages.rotation.z = Math.PI / 10;
    bookMeshGroup.add(leftBasePages);

    const rightBasePages = new THREE.Mesh(basePagesGeo, staticPageMat);
    rightBasePages.position.set(0.28, 0.035, 0);
    rightBasePages.rotation.z = -Math.PI / 10;
    bookMeshGroup.add(rightBasePages);

    // Gilt Edge Trims
    const giltEdgeGeo = new THREE.BoxGeometry(0.014, 0.055, 0.74);
    const leftGilt = new THREE.Mesh(giltEdgeGeo, goldGiltMat);
    leftGilt.position.set(-0.545, 0.035, 0);
    leftGilt.rotation.z = Math.PI / 10;
    bookMeshGroup.add(leftGilt);

    const rightGilt = new THREE.Mesh(giltEdgeGeo, goldGiltMat);
    rightGilt.position.set(0.545, 0.035, 0);
    rightGilt.rotation.z = -Math.PI / 10;
    bookMeshGroup.add(rightGilt);

    // Curved Spine Center
    const spineGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.8, 16, 1, false, 0, Math.PI);
    const spine = new THREE.Mesh(spineGeo, coverMat);
    spine.position.set(0, -0.015, 0);
    spine.rotation.x = Math.PI / 2;
    bookMeshGroup.add(spine);

    // Silk Bookmark Ribbon
    const ribbonGeo = new THREE.BoxGeometry(0.045, 0.008, 0.45);
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xb45309,
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.25
    });
    const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbon.position.set(0.06, 0.07, 0.22);
    ribbon.rotation.set(-0.25, 0.15, -0.1);
    bookMeshGroup.add(ribbon);

    // Multi-Leaf Slipping Pages (Arching upward gracefully without turning fully to the left!)
    // Multi-Leaf Slipping Pages (Arching upward gracefully in cascading fan waves)
    const numFlippingLeaves = 6;
    const flippingLeaves = [];

    const pageLeafGeo = new THREE.BoxGeometry(0.53, 0.006, 0.73);
    const pageLeafGiltGeo = new THREE.BoxGeometry(0.012, 0.006, 0.73);

    for (let i = 0; i < numFlippingLeaves; i++) {
      const leafPivot = new THREE.Group();
      leafPivot.position.set(0, 0.055, 0);

      const leafMesh = new THREE.Mesh(pageLeafGeo, activeFlippingPageMat);
      leafMesh.position.set(0.265, 0, 0);
      leafPivot.add(leafMesh);

      const leafGilt = new THREE.Mesh(pageLeafGiltGeo, goldGiltMat);
      leafGilt.position.set(0.525, 0, 0);
      leafPivot.add(leafGilt);

      const restAngle = -Math.PI / 10 + (i * 0.011);
      leafPivot.rotation.z = restAngle;

      bookMeshGroup.add(leafPivot);
      flippingLeaves.push({
        pivot: leafPivot,
        mesh: leafMesh,
        restAngle,
        phaseOffset: i * (1.0 / numFlippingLeaves)
      });
    }

    masterGroup.add(bookAnchor);

    // =========================================================================
    // ASSET 3: SCIENTIFIC LABORATORY FLASK (STRICTLY ON RIGHT OF "LEARN MORE")
    // Conical Erlenmeyer Flask of Discovery - Borosilicate glass, volumetric
    // graduations, glowing discovery liquid, glass stirring rod, & rising bubbles.
    // =========================================================================
    const flaskAnchor = new THREE.Group();
    const flaskHomePos = {
      x: isMobile ? 1.50 : 2.20,
      y: isMobile ? -0.42 : -0.38,
      z: isMobile ? 0.15 : 0.20
    };
    flaskAnchor.position.set(flaskHomePos.x, flaskHomePos.y, flaskHomePos.z);
    flaskAnchor.scale.setScalar(isMobile ? 0.34 : 0.44);

    const flaskMeshGroup = new THREE.Group();
    flaskMeshGroup.rotation.set(0.22, -0.35, 0.12);
    flaskAnchor.add(flaskMeshGroup);

    // 3A. Ultra-Clear Borosilicate Glass Materials
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xecfeff,
      transmission: 0.88,
      opacity: 0.65,
      transparent: true,
      roughness: 0.08,
      metalness: 0.12,
      ior: 1.52,
      reflectivity: 0.9,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    // Conical Main Flask Body
    const coneGeo = new THREE.CylinderGeometry(0.13, 0.46, 0.64, 32, 1, true);
    const coneMesh = new THREE.Mesh(coneGeo, glassMat);
    flaskMeshGroup.add(coneMesh);

    // Cylindrical Neck
    const neckGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.32, 32, 1, true);
    const neckMesh = new THREE.Mesh(neckGeo, glassMat);
    neckMesh.position.y = 0.48;
    flaskMeshGroup.add(neckMesh);

    // Flared Rim Lip at Top
    const rimGeo = new THREE.TorusGeometry(0.14, 0.024, 16, 32);
    const rimMesh = new THREE.Mesh(rimGeo, glassMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 0.64;
    flaskMeshGroup.add(rimMesh);

    // Base Glass Bottom Plate & Rounded Rim
    const basePlateGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.025, 32);
    const basePlateMesh = new THREE.Mesh(basePlateGeo, glassMat);
    basePlateMesh.position.y = -0.32;
    flaskMeshGroup.add(basePlateMesh);

    const baseRingGeo = new THREE.TorusGeometry(0.45, 0.022, 16, 32);
    const baseRingMesh = new THREE.Mesh(baseRingGeo, glassMat);
    baseRingMesh.rotation.x = Math.PI / 2;
    baseRingMesh.position.y = -0.32;
    flaskMeshGroup.add(baseRingMesh);

    // 3B. Luminescent Discovery Liquid (Cyan-Emerald Scientific Elixir)
    const liquidMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      roughness: 0.15,
      metalness: 0.25,
      transparent: true,
      opacity: 0.82
    });
    const liquidGeo = new THREE.CylinderGeometry(0.24, 0.43, 0.40, 32);
    const liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
    liquidMesh.position.y = -0.11;
    flaskMeshGroup.add(liquidMesh);

    // Top Liquid Meniscus
    const meniscusMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.75,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.92
    });
    const meniscusGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.015, 32);
    const meniscusMesh = new THREE.Mesh(meniscusGeo, meniscusMat);
    meniscusMesh.position.y = 0.09;
    flaskMeshGroup.add(meniscusMesh);

    // 3C. Etched Volumetric Measurement Graduations (50ml, 100ml, 150ml, 200ml)
    const tickMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8
    });
    const tickLevels = [
      { y: -0.22, r: 0.40 },
      { y: -0.11, r: 0.34 },
      { y: 0.00, r: 0.29 },
      { y: 0.11, r: 0.23 }
    ];
    tickLevels.forEach(({ y, r }) => {
      const arcGeo = new THREE.TorusGeometry(r + 0.003, 0.006, 8, 24, Math.PI * 0.7);
      const arcMesh = new THREE.Mesh(arcGeo, tickMat);
      arcMesh.rotation.x = Math.PI / 2;
      arcMesh.rotation.z = Math.PI * 0.15;
      arcMesh.position.y = y;
      flaskMeshGroup.add(arcMesh);
    });

    // 3D. Sleek Borosilicate Stirring Rod
    const rodMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.75
    });
    const rodGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.92, 12);
    const rodMesh = new THREE.Mesh(rodGeo, rodMat);
    rodMesh.position.set(-0.04, 0.28, 0);
    rodMesh.rotation.z = 0.26;
    rodMesh.rotation.x = -0.12;
    flaskMeshGroup.add(rodMesh);

    const rodTipGeo = new THREE.SphereGeometry(0.016, 10, 10);
    const rodTipTop = new THREE.Mesh(rodTipGeo, rodMat);
    rodTipTop.position.set(-0.16, 0.72, 0.05);
    flaskMeshGroup.add(rodTipTop);

    // 3E. Effervescent Rising Micro-Bubbles
    const bubbleCount = 10;
    const bubbleGeo = new THREE.SphereGeometry(0.022, 10, 10);
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85
    });
    const bubbles = [];
    for (let i = 0; i < bubbleCount; i++) {
      const bMesh = new THREE.Mesh(bubbleGeo, bubbleMat);
      const bScale = 0.4 + Math.random() * 0.7;
      bMesh.scale.setScalar(bScale);
      const bData = {
        mesh: bMesh,
        radius: 0.04 + Math.random() * 0.18,
        angle: Math.random() * Math.PI * 2,
        y: -0.28 + Math.random() * 0.36,
        speed: 0.22 + Math.random() * 0.26
      };
      bMesh.position.set(Math.cos(bData.angle) * bData.radius, bData.y, Math.sin(bData.angle) * bData.radius);
      flaskMeshGroup.add(bMesh);
      bubbles.push(bData);
    }

    // 3F. Effervescent Reaction Vapor Micro-Particles (Rising from rim on hover)
    const vaporCount = 4;
    const vaporGeo = new THREE.SphereGeometry(0.016, 8, 8);
    const vaporMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0
    });
    const vaporParticles = [];
    for (let i = 0; i < vaporCount; i++) {
      const vMesh = new THREE.Mesh(vaporGeo, vaporMat.clone());
      vMesh.position.set(0, 0.66, 0);
      flaskMeshGroup.add(vMesh);
      vaporParticles.push({
        mesh: vMesh,
        y: 0.66 + i * 0.12,
        speed: 0.28 + Math.random() * 0.15,
        offset: Math.random() * Math.PI * 2
      });
    }

    // 3G. Internal Point Light (Luminescent Chemical Glow)
    const flaskLight = new THREE.PointLight(0x06b6d4, 0.5, 2.8);
    flaskLight.position.set(0, -0.05, 0.1);
    flaskMeshGroup.add(flaskLight);

    masterGroup.add(flaskAnchor);

    // =========================================================================
    // ASSET 4: AMBIENT CELESTIAL STARDUST PARTICLES
    // =========================================================================
    const particleCount = isMobile ? 26 : 42;
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
      size: isMobile ? 0.038 : 0.052,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    masterGroup.add(particleSystem);

    // =========================================================================
    // 5. INTERACTIVE MOUSE TRACKING ON HERO IMAGE
    // =========================================================================
    let mouseNormX = 0;
    let mouseNormY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;
    let clientMouseX = -9999;
    let clientMouseY = -9999;
    let isAtomHovered = false;
    let isTooltipHovered = false;

    const heroContainerEl = container.closest('.hero-container') || container.parentElement || window;
    const tooltipEl = tooltipRef.current;

    const onTooltipEnter = () => { isTooltipHovered = true; };
    const onTooltipLeave = () => { isTooltipHovered = false; };
    if (tooltipEl) {
      tooltipEl.addEventListener('mouseenter', onTooltipEnter);
      tooltipEl.addEventListener('mouseleave', onTooltipLeave);
    }

    const handlePointerMove = (e) => {
      const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
      const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
      if (clientX === undefined || clientY === undefined) return;

      clientMouseX = clientX;
      clientMouseY = clientY;

      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        targetMouseX = Math.max(-0.5, Math.min(0.5, (clientX - rect.left) / rect.width - 0.5));
        targetMouseY = Math.max(-0.5, Math.min(0.5, (clientY - rect.top) / rect.height - 0.5));
      } else {
        targetMouseX = (clientX / window.innerWidth - 0.5);
        targetMouseY = (clientY / window.innerHeight - 0.5);
      }
    };

    const handlePointerLeave = () => {
      clientMouseX = -9999;
      clientMouseY = -9999;
      targetMouseX = 0;
      targetMouseY = 0;
    };

    const handleContainerClick = (e) => {
      const rect = container.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const atomWorldPos = new THREE.Vector3();
      atomAnchor.getWorldPosition(atomWorldPos);
      const projected = atomWorldPos.clone().project(camera);
      const atomScreenX = (projected.x * 0.5 + 0.5) * rect.width;
      const atomScreenY = (-projected.y * 0.5 + 0.5) * rect.height;

      const dist = Math.hypot(clickX - atomScreenX, clickY - atomScreenY);
      const threshold = isMobile ? 70 : 95;
      if (dist < threshold) {
        setPinnedTooltip((prev) => !prev);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    if (heroContainerEl && heroContainerEl.addEventListener) {
      heroContainerEl.addEventListener('pointerleave', handlePointerLeave, { passive: true });
      heroContainerEl.addEventListener('click', handleContainerClick);
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
      camera.position.z = mobileNow ? 6.5 : 5.2;
      camera.updateProjectionMatrix();

      renderer.setSize(newWidth, newHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobileNow ? 1.5 : 2));

      const newBaseScale = mobileNow ? 0.55 : 0.72;
      masterGroup.scale.set(newBaseScale, newBaseScale, newBaseScale);

      // Reposition anchors with clean comfortable spacing
      atomHomePos.y = mobileNow ? 1.00 : 1.22;
      atomAnchor.scale.setScalar(mobileNow ? 0.44 : 0.58);

      bookHomePos.x = mobileNow ? -1.60 : -2.35;
      bookHomePos.y = mobileNow ? -0.42 : -0.38;
      bookAnchor.scale.setScalar(mobileNow ? 0.34 : 0.44);

      flaskHomePos.x = mobileNow ? 1.50 : 2.20;
      flaskHomePos.y = mobileNow ? -0.42 : -0.38;
      flaskAnchor.scale.setScalar(mobileNow ? 0.34 : 0.44);
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
    // 8. QUANTUM CARBON ATOM & MICRO-INTERACTION RENDER LOOP
    // =========================================================================
    let lastTime = performance.now();
    let innerElectronAngle = 0;
    let valenceElectronAngle1 = 0;
    let valenceElectronAngle2 = Math.PI / 2;
    let valenceElectronAngle3 = Math.PI;
    let valenceElectronAngle4 = (3 * Math.PI) / 2;

    let flaskLiftProgress = 0;
    let flaskSwirlAngle = 0;
    let bookLiftProgress = 0;
    let continuousPageTurnCycle = 0;
    let atomPatrolCycle = 0;

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

      // Calculate atom screen coordinates for hover collision & tooltip tracking
      const atomWorldPos = new THREE.Vector3();
      atomAnchor.getWorldPosition(atomWorldPos);
      const projected = atomWorldPos.clone().project(camera);
      const rect = container.getBoundingClientRect();
      const atomScreenX = (projected.x * 0.5 + 0.5) * rect.width;
      const atomScreenY = (-projected.y * 0.5 + 0.5) * rect.height;

      const mouseRelX = clientMouseX - rect.left;
      const mouseRelY = clientMouseY - rect.top;
      const distToAtom = Math.hypot(mouseRelX - atomScreenX, mouseRelY - atomScreenY);
      const hoverThreshold = isMobile ? 70 : 95;

      const isDirectHover = distToAtom < hoverThreshold;
      isAtomHovered = isDirectHover || isTooltipHovered || pinnedTooltipRef.current;

      if (heroContainerEl && heroContainerEl.style) {
        heroContainerEl.style.cursor = isDirectHover ? 'pointer' : '';
      }

      // Position and update HTML scientific tooltip card (strictly in empty top area above atom & all hero elements)
      if (tooltipEl) {
        if (isAtomHovered) {
          const cardWidth = isMobile ? 265 : 295;
          const cardHeight = isMobile ? 138 : 126;

          let targetX = atomScreenX - (cardWidth / 2);
          targetX = Math.max(12, Math.min(targetX, rect.width - cardWidth - 12));

          // Position strictly in the clear empty area at top of hero, clearing atom and motto text completely
          const minTopMargin = isMobile ? 8 : 12;
          let targetY = atomScreenY - cardHeight - 50;
          if (targetY < minTopMargin) {
            targetY = minTopMargin;
          }

          tooltipEl.style.transform = `translate3d(${Math.round(targetX)}px, ${Math.round(targetY)}px, 0)`;
          tooltipEl.style.opacity = '1';
          tooltipEl.style.pointerEvents = 'auto';
        } else {
          tooltipEl.style.opacity = '0';
          tooltipEl.style.pointerEvents = 'none';
        }
      }

      // Slow down traversal when inspecting atom on hover
      const traversalSpeed = isAtomHovered ? 0.08 : 0.40;
      atomPatrolCycle += delta * traversalSpeed * speedMult;

      // Full horizontal sweep width covering the motto text end to end
      const sweepWidth = isMobile ? 1.85 : 2.90;
      const normalSweepX = Math.sin(atomPatrolCycle) * sweepWidth;
      const normalSweepY = Math.cos(atomPatrolCycle * 2) * 0.08;

      // Interactive mouse influence added to the normal route
      const mouseInfluenceX = mouseNormX * (isMobile ? 0.6 : 0.9);
      const mouseInfluenceY = -mouseNormY * (isMobile ? 0.35 : 0.5);

      const targetAtomX = normalSweepX + mouseInfluenceX;
      const targetAtomY = atomHomePos.y + normalSweepY + mouseInfluenceY;

      // Glide smoothly along route
      atomAnchor.position.x += (targetAtomX - atomAnchor.position.x) * 0.08;
      atomAnchor.position.y += (targetAtomY - atomAnchor.position.y) * 0.08;

      // Gentle aerodynamic banking tilt along direction of travel
      const sweepVelocityX = Math.cos(atomPatrolCycle); // + when moving right, - when moving left
      const bankingTiltZ = -sweepVelocityX * 0.12;

      // Gyroscopic rotational orientation towards mouse + flight bank
      const targetAtomRotY = (mouseNormX * 1.8) + (sweepVelocityX * 0.25);
      const targetAtomRotX = -mouseNormY * 1.4;
      atomInteractiveGroup.rotation.y += (targetAtomRotY - atomInteractiveGroup.rotation.y) * 0.08;
      atomInteractiveGroup.rotation.x += (targetAtomRotX - atomInteractiveGroup.rotation.x) * 0.08;
      atomInteractiveGroup.rotation.z += (bankingTiltZ - atomInteractiveGroup.rotation.z) * 0.08;

      // Gentle floating nuclear pulse
      const nucleusPulse = 1.0 + Math.sin(time * 0.003 * speedMult) * 0.05;
      nucleusShell.scale.set(nucleusPulse, nucleusPulse, nucleusPulse);

      // Quantum speed boost when mouse is actively moving
      const mouseSpeedBoost = 1.0 + Math.hypot(mouseNormX, mouseNormY) * 3.0;

      // 1. Inner Shell (1s²) Electrons Animation:
      // High-speed paired quantum orbit (radius = 0.50), diametrically opposite (180° Pauli paired)
      // Speed is ~3.2 rad/s, exactly 2x valence speed obeying Bohr velocity v_n ∝ 1/n
      innerElectronAngle += 3.2 * delta * speedMult * mouseSpeedBoost;
      electron1.position.set(Math.cos(innerElectronAngle) * 0.50, Math.sin(innerElectronAngle) * 0.50, 0);
      electron2.position.set(Math.cos(innerElectronAngle + Math.PI) * 0.50, Math.sin(innerElectronAngle + Math.PI) * 0.50, 0);

      // 2. Outer Valence Shell (2s² 2p² / sp³) Electrons Animation:
      // 4 electrons in distinct tetrahedral orbital planes with staggered phases (0, π/2, π, 3π/2)
      // Moving at quantum orbital speed ~1.6 rad/s on their respective planes
      valenceElectronAngle1 += 1.6 * delta * speedMult * mouseSpeedBoost;
      valenceElectronAngle2 += 1.6 * delta * speedMult * mouseSpeedBoost;
      valenceElectronAngle3 += 1.6 * delta * speedMult * mouseSpeedBoost;
      valenceElectronAngle4 += 1.6 * delta * speedMult * mouseSpeedBoost;

      electron3.position.set(Math.cos(valenceElectronAngle1) * valenceRadius, Math.sin(valenceElectronAngle1) * valenceRadius, 0);
      electron4.position.set(Math.cos(valenceElectronAngle2) * valenceRadius, Math.sin(valenceElectronAngle2) * valenceRadius, 0);
      electron5.position.set(Math.cos(valenceElectronAngle3) * valenceRadius, Math.sin(valenceElectronAngle3) * valenceRadius, 0);
      electron6.position.set(Math.cos(valenceElectronAngle4) * valenceRadius, Math.sin(valenceElectronAngle4) * valenceRadius, 0);

      // Quantum relativistic orbital precession within orbital planes
      ringV1.rotateZ(0.18 * delta * speedMult);
      ringV2.rotateZ(-0.16 * delta * speedMult);
      ringV3.rotateZ(0.14 * delta * speedMult);
      ringV4.rotateZ(-0.15 * delta * speedMult);
      innerRing.rotateZ(0.28 * delta * speedMult);

      // -----------------------------------------------------------------------
      // 8B. BOOK: ENHANCED HOVER RESPONSIVE CELEBRATION
      // -----------------------------------------------------------------------
      const isAdmissionsHovered = hoveredActionRef.current === 'admissions';
      const targetBookLift = isAdmissionsHovered ? 1 : 0;
      // Snappy spring-damped responsive lerp factor (0.14 vs old 0.08)
      bookLiftProgress += (targetBookLift - bookLiftProgress) * 0.14;

      const bookIdleBob = Math.cos(time * 0.0015 * speedMult) * 0.04;
      bookAnchor.position.y = bookHomePos.y + bookIdleBob + (bookLiftProgress * 0.28);
      bookAnchor.position.z = bookHomePos.z + (bookLiftProgress * 0.32);
      bookAnchor.position.x = bookHomePos.x + (bookLiftProgress * 0.10);

      // Scale boost for dynamic focus
      const bookScaleBoost = 1.0 + (bookLiftProgress * 0.12);
      bookMeshGroup.scale.set(bookScaleBoost, bookScaleBoost, bookScaleBoost);

      // Presentation tilt towards viewer to showcase open pages
      bookMeshGroup.rotation.x = 0.38 - (bookLiftProgress * 0.20) + Math.sin(time * 0.002 * speedMult) * (0.03 * bookLiftProgress);
      bookMeshGroup.rotation.y = 0.42 - (bookLiftProgress * 0.22);
      bookMeshGroup.rotation.z = -0.18 + (bookLiftProgress * 0.10);

      if (isAdmissionsHovered) {
        continuousPageTurnCycle += delta * 3.6 * speedMult;
      }

      // Page slipping motion: pages lift, arch up, and flutter in a rich cascading wave
      const rightRestAngle = -Math.PI / 10;
      const fanPeakAngle = -Math.PI / 36;

      flippingLeaves.forEach((leaf) => {
        if (isAdmissionsHovered) {
          const leafPhase = (continuousPageTurnCycle + leaf.phaseOffset) % 1.0;
          const flutterWave = Math.sin(leafPhase * Math.PI);
          const turnAngle = rightRestAngle + (fanPeakAngle - rightRestAngle) * flutterWave;
          leaf.pivot.rotation.z = turnAngle;

          const archHeight = flutterWave * 0.075;
          leaf.pivot.position.y = 0.055 + archHeight;
          leaf.mesh.rotation.y = flutterWave * 0.09;
          leaf.mesh.rotation.x = Math.sin(leafPhase * Math.PI * 2) * 0.04;
        } else {
          leaf.pivot.rotation.z += (leaf.restAngle - leaf.pivot.rotation.z) * 0.12;
          leaf.pivot.position.y += (0.055 - leaf.pivot.position.y) * 0.12;
          leaf.mesh.rotation.y += (0 - leaf.mesh.rotation.y) * 0.12;
          leaf.mesh.rotation.x += (0 - leaf.mesh.rotation.x) * 0.12;
        }
      });

      // Warm library knowledge illumination
      bookLight.intensity = bookLiftProgress * 3.8;
      activeFlippingPageMat.emissiveIntensity = 0.15 + (bookLiftProgress * 0.55);
      goldGiltMat.emissiveIntensity = 0.45 + (bookLiftProgress * 0.55);

      // Bookmark ribbon organic harmonic flutter
      ribbon.rotation.z = -0.1 + Math.sin(time * 0.0035 * speedMult) * (0.05 + bookLiftProgress * 0.25);
      ribbon.rotation.x = -0.25 + Math.cos(time * 0.003 * speedMult) * (0.03 + bookLiftProgress * 0.18);

      // -----------------------------------------------------------------------
      // 8C. SCIENTIFIC FLASK: ENHANCED HOVER RESPONSIVE DISCOVERY REACTION
      // -----------------------------------------------------------------------
      const targetFlaskLift = isAdmissionsHovered ? 1 : 0;
      // Snappy spring-damped responsive lerp factor (0.14 vs old 0.10)
      flaskLiftProgress += (targetFlaskLift - flaskLiftProgress) * 0.14;

      const flaskIdleBob = Math.sin(time * 0.0018 * speedMult) * 0.04;
      flaskAnchor.position.y = flaskHomePos.y + flaskIdleBob + (flaskLiftProgress * 0.28);
      flaskAnchor.position.z = flaskHomePos.z + (flaskLiftProgress * 0.32);
      flaskAnchor.position.x = flaskHomePos.x - (flaskLiftProgress * 0.10);

      // Scale boost for dynamic focus
      const flaskScaleBoost = 1.0 + (flaskLiftProgress * 0.12);
      flaskMeshGroup.scale.set(flaskScaleBoost, flaskScaleBoost, flaskScaleBoost);

      // Presentation tilt towards viewer to showcase chemical reaction
      flaskMeshGroup.rotation.x = 0.22 + (flaskLiftProgress * 0.16) + Math.sin(time * 0.002 * speedMult) * (0.03 * flaskLiftProgress);
      flaskMeshGroup.rotation.y = -0.35 + (flaskLiftProgress * 0.22);
      flaskMeshGroup.rotation.z = 0.12 - (flaskLiftProgress * 0.15);

      // Chemical solution vortex swirl inside flask
      liquidMesh.rotation.y += delta * (isAdmissionsHovered ? 3.8 : 0.8) * speedMult;
      meniscusMesh.rotation.y += delta * (isAdmissionsHovered ? 3.8 : 0.8) * speedMult;
      meniscusMesh.position.y = 0.09 + Math.sin(time * 0.006 * speedMult) * (0.015 * flaskLiftProgress);

      // Stirring rod active laboratory motion
      rodMesh.rotation.z = 0.26 + Math.sin(time * 0.006 * speedMult) * (0.07 * flaskLiftProgress);
      rodMesh.rotation.x = -0.12 + Math.cos(time * 0.006 * speedMult) * (0.05 * flaskLiftProgress);
      rodTipTop.position.x = -0.16 + Math.sin(time * 0.006 * speedMult) * (0.035 * flaskLiftProgress);

      // Effervescent micro-bubble spiral physics simulation
      const bubbleSpeedMult = isAdmissionsHovered ? 3.8 : 1.0;
      bubbles.forEach((b) => {
        b.y += b.speed * delta * bubbleSpeedMult * speedMult;
        b.angle += delta * (isAdmissionsHovered ? 4.8 : 1.2) * speedMult;
        if (b.y > 0.09) {
          b.y = -0.28;
          b.radius = 0.04 + Math.random() * 0.18;
          b.angle = Math.random() * Math.PI * 2;
        }
        b.mesh.position.y = b.y;
        b.mesh.position.x = Math.sin(b.angle) * b.radius;
        b.mesh.position.z = Math.cos(b.angle) * b.radius;
      });

      // Effervescent reaction vapor emerging from neck
      vaporParticles.forEach((v) => {
        if (flaskLiftProgress > 0.05) {
          v.y += v.speed * delta * (1.0 + flaskLiftProgress * 1.5) * speedMult;
          if (v.y > 1.25) {
            v.y = 0.66;
          }
          v.mesh.position.y = v.y;
          v.mesh.position.x = Math.sin(time * 0.004 + v.offset) * 0.05;
          v.mesh.position.z = Math.cos(time * 0.004 + v.offset) * 0.05;
          const normY = (v.y - 0.66) / 0.59;
          const fade = Math.sin(normY * Math.PI);
          v.mesh.material.opacity = fade * 0.85 * flaskLiftProgress;
          v.mesh.scale.setScalar(0.8 + normY * 1.2);
        } else {
          v.mesh.material.opacity = 0;
        }
      });

      // Luminescent chemical reaction glow
      flaskLight.intensity = 0.5 + (flaskLiftProgress * 3.4);
      const activeLiquidEmissive = 0.5 + (flaskLiftProgress * (0.65 + Math.sin(time * 0.008 * speedMult) * 0.18));
      liquidMat.emissiveIntensity = activeLiquidEmissive;
      meniscusMat.emissiveIntensity = 0.75 + (flaskLiftProgress * 0.55);

      // -----------------------------------------------------------------------
      // 8D. STARDUST PARTICLES
      // -----------------------------------------------------------------------
      particleSystem.rotation.y += 0.035 * delta * speedMult;

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
      if (tooltipEl) {
        tooltipEl.removeEventListener('mouseenter', onTooltipEnter);
        tooltipEl.removeEventListener('mouseleave', onTooltipLeave);
      }
      if (heroContainerEl && heroContainerEl.removeEventListener) {
        heroContainerEl.removeEventListener('pointerleave', handlePointerLeave);
        heroContainerEl.removeEventListener('click', handleContainerClick);
      }
      resizeObserver.disconnect();
      intersectionObserver.disconnect();

      if (logoTexture) logoTexture.dispose();

      scene.traverse((child) => {
        if (child.isMesh || child.isPoints || child.isSprite) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => {
                if (m.map) m.map.dispose();
                m.dispose();
              });
            } else {
              if (child.material.map) child.material.map.dispose();
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
      className={`hero-3d-canvas-container absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible ${className}`}
      style={{ opacity: 0.94 }}
    >
      {/* Compact Interactive Carbon Atom & School Seal Scientific Tooltip Card (Placed strictly above all) */}
      <div
        ref={tooltipRef}
        role="tooltip"
        aria-hidden={!pinnedTooltip}
        className="absolute transition-opacity duration-300 pointer-events-none opacity-0 z-50"
        style={{
          top: 0,
          left: 0,
          transform: 'translate3d(-9999px, -9999px, 0)'
        }}
      >
        <div className="relative w-[265px] sm:w-[295px] bg-slate-950/95 backdrop-blur-xl border border-cyan-500/40 rounded-xl shadow-2xl shadow-cyan-950/80 p-2 sm:p-2.5 text-left pointer-events-auto text-slate-100 ring-1 ring-white/10">
          {/* Top glowing accent hairline */}
          <div className="absolute top-0 inset-x-3 h-[2px] bg-gradient-to-r from-cyan-400 via-amber-400 to-emerald-400 rounded-full" />
          
          {/* Compact Header */}
          <div className="flex items-center justify-between gap-1.5 pb-1.5 mb-1.5 border-b border-slate-700/60">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-bold text-[10px] shadow-xs shadow-cyan-500/30 font-mono">
                ₆C
              </span>
              <div>
                <h4 className="font-bold text-white text-[11px] sm:text-xs tracking-wide flex items-center gap-1 leading-none font-heading">
                  Carbon-12 Orbitals
                </h4>
                <span className="text-[9px] sm:text-[9.5px] text-cyan-300/90 font-mono">
                  Z = 6 • 1s² 2s² 2p² (sp³)
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setPinnedTooltip(false);
                if (tooltipRef.current) {
                  tooltipRef.current.style.opacity = '0';
                  tooltipRef.current.style.pointerEvents = 'none';
                }
              }}
              className="text-slate-400 hover:text-white p-0.5 rounded text-xs sm:hidden leading-none"
              aria-label="Close details"
            >
              ✕
            </button>
          </div>

          {/* 3 Compact Micro Detail Blocks */}
          <div className="space-y-1.5 text-[9.5px] sm:text-[10px] text-slate-300 leading-snug">
            {/* 1. Carbon */}
            <div className="flex items-start gap-1.5 bg-slate-900/80 rounded-md p-1.5 border border-slate-800/80">
              <span className="text-cyan-400 text-xs shrink-0 mt-0.5">⚛️</span>
              <div>
                <span className="font-semibold text-cyan-200">Carbon of Life:</span>{' '}
                <span className="text-slate-300">2 inner 1s² core + 4 valence sp³ electrons; fundamental foundation of organic life.</span>
              </div>
            </div>

            {/* 2. School Logo */}
            <div className="flex items-start gap-1.5 bg-slate-900/80 rounded-md p-1.5 border border-slate-800/80">
              <span className="text-amber-400 text-xs shrink-0 mt-0.5">🏫</span>
              <div>
                <span className="font-semibold text-amber-200">HSS Shangus Nucleus:</span>{' '}
                <span className="text-slate-300">Official seal at atomic core — source of knowledge, ethics & discipline.</span>
              </div>
            </div>

            {/* 3. Overall Theme */}
            <div className="flex items-start gap-1.5 bg-slate-900/80 rounded-md p-1.5 border border-slate-800/80">
              <span className="text-emerald-400 text-xs shrink-0 mt-0.5">🌌</span>
              <div>
                <span className="font-semibold text-emerald-200">Educational Theme:</span>{' '}
                <span className="text-slate-300">Patrolling over <em className="text-white not-italic font-semibold font-slogan">"nurturing minds, shaping futures"</em> to ignite potential.</span>
              </div>
            </div>
          </div>

          {/* Subtle downward directional pip connecting the card to the atom below */}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-950 border-r border-b border-cyan-500/40 rotate-45" />
        </div>
      </div>
    </div>
  );
}
