FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-env
WORKDIR /App

# Install Node.js 22 LTS (frontend is built via the .csproj NpmBuild MSBuild target)
RUN apt-get update && apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_22.x | bash -
RUN apt-get install -y nodejs

# Restore layer caching. GITLAB_NUGET_USERNAME/GITLAB_NUGET_TOKEN authenticate
# the private DeliverDifferent.AccessControl feed (see nuget.config). They
# arrive as build args (project-level AUTO_DEVOPS_BUILD_IMAGE_EXTRA_ARGS, as on
# routed-operations) and MUST be declared as ARG or Docker discards them and
# restore 401s. Set on the RUN line rather than ENV so the token is not baked
# into an image layer.
ARG GITLAB_NUGET_USERNAME
ARG GITLAB_NUGET_TOKEN
COPY nuget.config Directory.Packages.props ./
COPY SetupDashboard.Api/SetupDashboard.Api.csproj SetupDashboard.Api/
RUN GITLAB_NUGET_USERNAME=${GITLAB_NUGET_USERNAME} GITLAB_NUGET_TOKEN=${GITLAB_NUGET_TOKEN} dotnet restore SetupDashboard.Api/SetupDashboard.Api.csproj

COPY . ./
RUN dotnet publish SetupDashboard.Api/SetupDashboard.Api.csproj -c Release -o /publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
COPY --from=build-env /publish /app
WORKDIR /app
EXPOSE 8080
ENTRYPOINT ["dotnet", "SetupDashboard.Api.dll"]
