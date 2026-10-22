import HomePage from "@/app.f7";
import AboutPage from "@/pages/about.f7";
import BugsPage from "@/pages/bugs.f7";
import DependenciesPage from "@/pages/dependencies.f7";

var routes = [
  {
    path: "/",
    name: "home",
    component: HomePage,
    master: true,
    keepAlive: true,
  },
  {
    path: "/about/",
    name: "about",
    component: AboutPage,
    keepAlive: true,
  },
  {
    path: "/bugs/",
    name: "bugs",
    component: BugsPage,
    keepAlive: true,
  },
  {
    path: "/dependencies/",
    name: "dependencies",
    component: DependenciesPage,
    keepAlive: true,
  },
];

export default routes;
