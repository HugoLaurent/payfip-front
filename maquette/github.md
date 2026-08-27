repo: HugoLaurent/payfip-front
branch: main

## Last sync
date: 2026-08-24T08:36:04Z

### Updated in this project
- Nouvelle maquette "Scanner Terrain.dc.html" : refonte mobile-first de ScannerPage.tsx (9 écrans — viseur plein écran, résultats en couleur pleine valide/déjà scanné/refusé, panneau commande groupée avec "Valider tout", saisie manuelle en bottom sheet, historique et choix du service escamotables, rendu desktop deux colonnes). Comportement conservé du code réel (RESULT_LABELS, reset-scan, OrderScanPanel) ; accent aregie-deep uniquement.
- Réaligné la maquette "Parcours Billetterie.dc.html" sur le parcours réel implémenté : ordre Email → Billets → Paiement (pas d'étape "Date" séparée, date modifiable en ligne sur l'écran Billets).
- Repris les tokens exacts (aregie-coral, success, date-tint, ref-tint, otp-bg, hairline) et le style bouton coral plein/ghost du code réel (PublicButtons.tsx).
- Repris la structure des écrans réels : PublicServiceHeader + StepIndicator (email/tickets), OtpDigitInput, PublicBottomBar, carte billet "ticket déchiré" + QR de PurchaseReturnPage.
- Nouvelle maquette "Espace Organisme.dc.html" : refonte visuelle des 6 écrans admin (Dashboard enrichi, Services, Vente, Historique, Scanner, Utilisateurs) + Sidebar, ton "entre les deux" (sobre/dense mais soigné), accent deep-blue uniquement (pas de corail côté agent).
- Ajout de l'écran détail service (grille tarifaire + lien de billetterie), équivalent ServiceAdmin.tsx/TariffsManager.tsx.
- Ajout des modals (ajout agent avec erreur de validation, confirmation d'archivage) et des toasts système (succès vert, erreur corail) — équivalent Modal.tsx/LoadError.tsx.
- Nouvelle maquette "Panel Staff - Organisme.dc.html" : page détail organisme du back-office staff (liste organismes avec statut suspendu, détail actif, modal de suspension calquée sur "Fermer le service", état organisme suspendu avec services verrouillés). Basée sur les vrais composants ui/ (Card, Modal, Buttons, PageHeader) et tokens index.css — Segoe UI + aregie-deep, pas de style premium public.

## Screen map
| Maquette | Fichiers repo source |
|---|---|
| Parcours Billetterie.dc.html — Écran 1 Email | src/pages/public/PublicPurchasePage.tsx (step "email"), OtpDigitInput.tsx, PublicServiceHeader.tsx, StepIndicator.tsx, steps.ts |
| Parcours Billetterie.dc.html — Écran 2 Billets | src/pages/public/PublicPurchasePage.tsx (step "tickets"), PublicBottomBar.tsx, PublicButtons.tsx |
| Parcours Billetterie.dc.html — Écran 3 Confirmation | src/pages/public/PurchaseReturnPage.tsx |
| Espace Organisme.dc.html — Sidebar/Dashboard | src/layouts/Sidebar.tsx, src/layouts/OrgSpace.tsx, src/pages/org/Dashboard.tsx |
| Espace Organisme.dc.html — Services | src/pages/org/ServicesPage.tsx, ServiceAdmin.tsx |
| Espace Organisme.dc.html — Vente | src/pages/org/VentePage.tsx |
| Espace Organisme.dc.html — Historique | src/pages/org/HistoriquePage.tsx |
| Espace Organisme.dc.html — Scanner | src/pages/org/ScannerPage.tsx |
| Scanner Terrain.dc.html — 9 écrans mobile + desktop | src/pages/org/ScannerPage.tsx (OrderScanPanel, RESULT_LABELS, TICKET_STATUS_LABELS, /tickets/scan, /orders/scan, /reset-scan) |
| Espace Organisme.dc.html — Utilisateurs | src/pages/org/UsersManager.tsx |
| Tokens couleur / typo | src/index.css |
