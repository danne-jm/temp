// Import explicitly by name
import { getAllSellables } from '../services/artPiece.service';

async function renderGallery() {
    console.log("Fetching gallery...");
    // Call it directly
    const items = await getAllSellables();
    console.log(items);
}

renderGallery();
