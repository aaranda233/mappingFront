const path = require("path");
const glob = require("glob");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

const INCLUDE_PATTERN =
  /<include\s+src=["'](.+?)["']\s*\/?>\s*(?:<\/include>)?/gis;

const processNestedHtml = (content, loaderContext, dir = null) =>
  !INCLUDE_PATTERN.test(content)
    ? content
    : content.replace(INCLUDE_PATTERN, (m, src) => {
      const filePath = path.resolve(dir || loaderContext.context, src);
      loaderContext.dependency(filePath);
      return processNestedHtml(
        loaderContext.fs.readFileSync(filePath, "utf8"),
        loaderContext,
        path.dirname(filePath),
      );
    });

// HTML generation
const paths = [];
const generateHTMLPlugins = () =>
  glob.sync("./src/*.html").map((dir) => {
    const filename = path.basename(dir);

    if (filename !== "404.html") {
      paths.push(filename);
    }

    return new HtmlWebpackPlugin({
      filename,
      template: `./src/${filename}`,
      favicon: `./src/images/logo/favicon.png`,
      inject: "body",
    });
  });

module.exports = {
  mode: "development",
  entry: "./src/js/index.js",
  devServer: {
    host: '0.0.0.0',        
    allowedHosts: 'all',      
    static: {
      directory: path.join(__dirname, "./build"),
    },
    compress: true,
    port: 3001,
    hot: true,
    watchFiles: {
      options: {
        usePolling: !!process.env.WATCHPACK_POLLING,
        interval: 1000,
      },
    },
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
      {
        test: /\.css$/i,
        use: [
          MiniCssExtractPlugin.loader,
          "css-loader",
          {
            loader: "postcss-loader",
            options: {
              postcssOptions: {
                plugins: [
                  require("autoprefixer")({
                    overrideBrowserslist: ["last 2 versions"],
                  }),
                ],
              },
            },
          },
        ],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: "asset/resource",
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: "asset/resource",
      },
      {
        test: /\.html$/,
        loader: "html-loader",
        options: {
          preprocessor: processNestedHtml,
          sources: {
            urlFilter: (attribute, value) => {
              // No procesar env.js — se inyecta en runtime vía ConfigMap
              if (value === "/env.js") return false;
              // No procesar erp-form.png — recurso estático servido en runtime
              if (value === "/erp-form.png") return false;
              // No procesar logos de clientes — recursos estáticos
              if (value === "/edeka.png" || value === "/iberiana.png" || value === "/eurogroup.png" || value === "/anecoop.png" || value === "/greenyard_2.png" || value === "/alfruit.png" || value === "/pelican.png" || value === "/img.jpg" || value === "/lehman.png") return false;
              return true;
            },
          },
        },
      },
    ],
  },
  plugins: [
    ...generateHTMLPlugins(),
    new MiniCssExtractPlugin({
      filename: "style.css",
      chunkFilename: "style.css",
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: "src/static", to: ".", noErrorOnMissing: true },
      ],
    }),
  ],
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "build"),
    clean: true,
    assetModuleFilename: "[path][name][ext]",
  },
  target: "web", // fix for "browserslist" error message
  stats: "errors-only", // suppress irrelevant log messages
};
