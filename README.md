# mARasense-experieces

Laboratorio WebAR open source pensato per esperienze accessibili da link o QR code, senza app da installare.

## Demo incluse

1. **Living Painting**
   - Tracking immagine per quadri, poster, brochure e opere stampate.
   - Stack previsto: Simple-AR + Three.js.

2. **Food Explosion**
   - Tracking immagine per piatti, menu o card stampate.
   - Stack previsto: MindAR + Three.js.

3. **Magic Object**
   - Tracking oggetti reali con ancoraggio 6DoF.
   - Stack previsto: WebAR.rocks.object + Three.js.

## Obiettivo

Avere tre proof of concept WebAR separati ma ospitati nello stesso repository, pubblicabili su GitHub Pages e apribili da smartphone tramite URL o QR code.

## Struttura

- `index.html`: landing principale.
- `apps/living-painting/`: demo 1.
- `apps/food-explosion/`: demo 2.
- `apps/magic-object/`: demo 3.
- `shared/`: CSS e JS condivisi.

## Note importanti

- La camera nel browser richiede HTTPS o localhost.
- GitHub Pages va bene per il deploy iniziale.
- Per demo stabili conviene partire da target controllati.

## Prossimi passi

1. Pubblicare questo repository su GitHub.
2. Attivare GitHub Pages.
3. Verificare che la landing si apra da mobile.
4. Implementare prima `living-painting`, poi `food-explosion`, poi `magic-object`.
