// Import explicitly by name
import { getAllProducts } from '../services/artPiece.service';
import { v4 as uuid } from 'uuid';
import { uuid as userUuid } from '../services/user.service';

async function renderGallery() {
    console.log("Fetching gallery...");
    // Call it directly
    const items = await getAllProducts();
    console.log(items);

    // Trigger both UUID variations: package and user service
    const packageUuid = uuid();
    const serviceUuid = userUuid();
    console.log({ packageUuid, serviceUuid });
}

renderGallery();
