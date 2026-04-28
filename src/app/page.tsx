import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Services from "@/components/Services";
import RequestForm from "@/components/RequestForm";
import ServiceAreas from "@/components/ServiceAreas";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <About />
      <Services />
      <RequestForm />
      <ServiceAreas />
      <Footer />
    </>
  );
}
