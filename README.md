# EPANET Utilities

A collection of free and open-source utilities for working with EPANET models. This repository is designed to provide tools that help modelers with common tasks, improving workflows and compatibility with other systems.

![Home Page](./public/github/homepage.png)

## Available Utilities

### 1. Projection Converter

📂 **Path:** `/app/projection-converter`

![Projection Converter](./public/github/projection-converter.png)

A utility for reprojecting EPANET `.inp` files to different coordinate reference systems (CRS). This tool helps ensure spatial systems match when integrating hydraulic models with GIS or other mapping applications.

## Installation & Usage

This is a Next.js application. To install dependencies and run the project:

```sh
# Clone the repository
git clone https://github.com/modelcreate/epanet-utilities.git
cd epanet-utilities

# Install dependencies
npm install  # or pnpm install / yarn install

# Run the development server
npm run dev  # or pnpm dev / yarn dev

# Build the project
npm run build

# Start the production server
npm run start

# Lint the code
npm run lint
```

## Contributing

Contributions are welcome! If you have ideas for new utilities or improvements to existing ones, feel free to open an issue or submit a pull request.

### Future Tools

- Set elevations, from worldwide DEM or ASCII file
- Extract GIS
- Export results, report and bin file
- Fire flow simulation
- .net file conversion
- compare .bin files between version of EPANET

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

🚀 More utilities coming soon!
