import { v4 as uuidPkg } from 'uuid';

// Export the function directly using a Named Export
export const getAllProducts = async () => {
    return [{ id: 1, title: "Conflict 1" }, { id: 2, title: "Conflict 2" }];
};

// Re-export a UUID function mirroring the package's default v4 usage
export const uuid = () => uuidPkg();

export const v4 = () => {
    return true;
};

export const uploadNewArtPiece = async () => {
    return true;
};


