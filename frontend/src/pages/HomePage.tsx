import HealthCheckButton from "../components/HealthCheckButton";
import FileUpload from "../components/FileUpload";

function HomePage() {
  return (
    <main>
      <h1>GeoPrep AI</h1>

      <p>Professional GIS data preparation for GeoAI workflows.</p>

      <HealthCheckButton />

      <hr />

      <FileUpload />
    </main>
  );
}

export default HomePage;
